#!/usr/bin/env node
'use strict';

/**
 * Claude Code stop hook — appends session cost to the configured AI cost log.
 * Receives session data as JSON via stdin.
 * Never overwrites existing rows.
 *
 * When the payload lacks cost/token fields (known issue in older Claude Code
 * versions), the row is written with zeros and tagged [NO_DATA] so it is
 * visually distinguishable from real entries.  The raw payload is always
 * saved to docs/capture-cost-debug.json so the actual hook contract can be
 * verified after any Claude Code upgrade.
 *
 * Token counts are derived by diffing ~/.claude/stats-cache.json snapshots
 * taken at session start (via --capture-baseline) and session end.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// --capture-baseline mode: snapshot stats-cache at session start
// ---------------------------------------------------------------------------
if (process.argv.includes('--capture-baseline')) {
  const sessionId = process.env.CLAUDE_SESSION_ID ?? 'unknown';
  const statsPath = path.join(os.homedir(), '.claude', 'stats-cache.json');
  const baselinePath = path.join(ROOT, 'docs', 'cost-baseline.json');
  let baselines = {};
  try { baselines = JSON.parse(fs.readFileSync(baselinePath, 'utf8')); } catch {}
  if (!baselines[sessionId]) {
    try {
      const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
      baselines[sessionId] = stats.modelUsage ?? {};
      fs.writeFileSync(baselinePath, JSON.stringify(baselines, null, 2));
    } catch {}
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// diffModelUsage — compute per-session token delta from two modelUsage maps
// ---------------------------------------------------------------------------

/**
 * Diff two modelUsage snapshots from stats-cache.json and return the
 * aggregate token delta across all models.
 *
 * @param {object|null} baseline - modelUsage at session start
 * @param {object|null} current  - modelUsage at session end
 * @returns {{ inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheCreationTokens: number }}
 */
function diffModelUsage(baseline, current) {
  const zero = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
  if (!baseline || !current) return zero;
  const result = { ...zero };
  for (const model of Object.keys(current)) {
    const c = current[model] ?? {};
    const b = baseline[model] ?? {};
    result.inputTokens         += (c.inputTokens              ?? 0) - (b.inputTokens              ?? 0);
    result.outputTokens        += (c.outputTokens             ?? 0) - (b.outputTokens             ?? 0);
    result.cacheReadTokens     += (c.cacheReadInputTokens     ?? 0) - (b.cacheReadInputTokens     ?? 0);
    result.cacheCreationTokens += (c.cacheCreationInputTokens ?? 0) - (b.cacheCreationInputTokens ?? 0);
  }
  for (const k of Object.keys(result)) result[k] = Math.max(0, result[k]);
  return result;
}

const DEFAULTS = {
  docs: { costLog: 'docs/AI_COST_LOG.md' },
};

function loadConfig() {
  const cfgPath = path.join(ROOT, 'plan-visualizer.config.json');
  if (!fs.existsSync(cfgPath)) return DEFAULTS;
  try {
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return { docs: { ...DEFAULTS.docs, ...raw.docs } };
  } catch { return DEFAULTS; }
}

const HEADER =
  '# AI Cost Log\n\n' +
  'Append-only ledger of AI session costs. Never edit or delete rows.\n' +
  'Updated automatically by the Claude Code stop hook (`tools/capture-cost.js`).\n\n' +
  '| Date | Session ID | Branch | Input Tokens | Output Tokens | Cache Read Tokens | Cost USD |\n' +
  '|---|---|---|---|---|---|---|\n';

/**
 * Build a single markdown table row from parsed Stop-hook payload data.
 * Exported for unit testing.
 *
 * @param {object} data        - Parsed JSON from Stop-hook stdin (may be empty)
 * @param {string} branch      - Current git branch
 * @param {string} date        - ISO date string (YYYY-MM-DD)
 * @param {object} [delta]     - Optional token delta from diffModelUsage()
 * @param {boolean} [hasBaseline] - Whether a baseline snapshot was available
 * @returns {{ row: string, hasData: boolean }}
 */
function buildRow(data, branch, date, delta, hasBaseline) {
  const costUsd = (data.cost_usd || data.total_cost || 0);
  const usage = data.usage || {};

  // Prefer stats-cache delta when available; fall back to Stop-hook payload fields.
  const inputTokens  = (delta && delta.inputTokens  > 0) ? delta.inputTokens  : (usage.input_tokens  || 0);
  const outputTokens = (delta && delta.outputTokens > 0) ? delta.outputTokens : (usage.output_tokens || 0);
  const cacheRead    = (delta && delta.cacheReadTokens > 0) ? delta.cacheReadTokens : (usage.cache_read_input_tokens || 0);

  // Detect payloads that contain no real cost or token data (e.g. older Claude
  // Code versions that only send { session_id, stop_hook_active }).
  // Only tag [NO_DATA] when there is truly nothing — i.e., no baseline was
  // found AND the payload fields are also empty.
  const hasData = costUsd > 0 || inputTokens > 0 || outputTokens > 0 || (hasBaseline === true);

  const sessionId = data.session_id
    ? (hasData ? data.session_id : `${data.session_id} [NO_DATA]`)
    : `sess_${Date.now()}${hasData ? '' : ' [NO_DATA]'}`;

  const row =
    `| ${date} | ${sessionId} | ${branch} | ` +
    `${inputTokens} | ${outputTokens} | ${cacheRead} | ` +
    `${costUsd.toFixed(4)} |\n`;

  return { row, hasData };
}

async function main() {
  const config = loadConfig();
  const LOG_PATH = path.join(ROOT, config.docs.costLog);
  const DEBUG_PATH = path.join(ROOT, 'docs', 'capture-cost-debug.json');

  let input = '';
  for await (const chunk of process.stdin) input += chunk;

  // Always save raw payload so we can verify the Stop-hook contract after
  // any Claude Code upgrade (file is gitignored via docs/capture-cost-debug.json).
  try {
    fs.writeFileSync(DEBUG_PATH, input || '{}', 'utf8');
  } catch { /* non-fatal — debug capture best-effort only */ }

  let data = {};
  try { data = JSON.parse(input); } catch { /* no stdin data */ }

  const date = new Date().toISOString().slice(0, 10);

  let branch = 'unknown';
  try { branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim(); } catch {}

  // Load stats-cache baseline and current snapshot to compute token delta.
  const BASELINE_PATH = path.join(ROOT, 'docs', 'cost-baseline.json');
  const STATS_PATH = path.join(os.homedir(), '.claude', 'stats-cache.json');
  const sessionId = data.session_id ?? null;

  let baselineModelUsage = null;
  let hasBaseline = false;
  if (sessionId) {
    try {
      const baselines = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
      if (baselines[sessionId]) {
        baselineModelUsage = baselines[sessionId];
        hasBaseline = true;
      }
    } catch { /* baseline file may not exist yet */ }
  }

  let currentModelUsage = null;
  try {
    const stats = JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));
    currentModelUsage = stats.modelUsage ?? null;
  } catch { /* stats-cache may be absent */ }

  const delta = diffModelUsage(baselineModelUsage, currentModelUsage);

  const { row, hasData } = buildRow(data, branch, date, delta, hasBaseline);

  const fd = fs.openSync(LOG_PATH, 'a');
  try {
    if (fs.fstatSync(fd).size === 0) fs.writeSync(fd, Buffer.from(HEADER, 'utf8'));
    fs.writeSync(fd, Buffer.from(row, 'utf8'));
  } finally {
    fs.closeSync(fd);
  }

  const costDisplay = (data.cost_usd || data.total_cost || 0).toFixed(4);
  if (hasData) {
    process.stderr.write(`[capture-cost] Appended session cost: $${costDisplay} on branch ${branch}\n`);
  } else {
    process.stderr.write(
      `[capture-cost] WARNING: Stop hook payload contained no cost/token data — row tagged [NO_DATA].\n` +
      `  Raw payload written to docs/capture-cost-debug.json for inspection.\n` +
      `  See docs/BUGS.md BUG-0031 for context.\n`
    );
  }
}

// Export for unit tests.  Guard main() so it doesn't run on require().
if (typeof module !== 'undefined') module.exports = { buildRow, diffModelUsage };
if (require.main === module) {
  main().catch(err => process.stderr.write(`[capture-cost] Error: ${err.message}\n`));
}
