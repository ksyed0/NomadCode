#!/usr/bin/env node
'use strict';

/**
 * NomadCode Plan Visualizer
 * Run: node tools/generate-plan.js
 * Output: Docs/plan-status.html + Docs/plan-status.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { parseReleasePlan } = require('./lib/parse-release-plan');
const { parseTestCases } = require('./lib/parse-test-cases');
const { parseBugs } = require('./lib/parse-bugs');
const { parseCostLog, aggregateCostByBranch } = require('./lib/parse-cost-log');
const { parseCoverage } = require('./lib/parse-coverage');
const { parseRecentActivity } = require('./lib/parse-progress');
const { computeProjectedCost, attributeAICosts } = require('./lib/compute-costs');
const { detectAtRisk } = require('./lib/detect-at-risk');
const { renderHtml } = require('./lib/render-html');

const ROOT = path.join(__dirname, '..');
const HOURS = { S: 4, M: 8, L: 16, XL: 32 };
const RATE = 100;

function readFile(relPath) {
  const full = path.join(ROOT, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function readJson(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  try { return JSON.parse(fs.readFileSync(full, 'utf8')); } catch { return null; }
}

function getCommitSha() {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; }
}

function main() {
  console.log('[generate-plan] Reading source files...');

  const { epics, stories, tasks } = parseReleasePlan(readFile('Docs/RELEASE_PLAN.md'));
  const testCases = parseTestCases(readFile('Docs/TEST_CASES.md'));
  const bugs = parseBugs(readFile('Docs/BUGS.md'));
  const costRows = parseCostLog(readFile('Docs/AI_COST_LOG.md'));
  const costByBranch = aggregateCostByBranch(costRows);
  const coverageJson = readJson('mobile-ide/mobile-ide-prototype/coverage/coverage-summary.json');
  const coverage = coverageJson
    ? parseCoverage(coverageJson)
    : { lines: 0, statements: 0, functions: 0, branches: 0, overall: 0, meetsTarget: false };
  const recentActivity = parseRecentActivity(readFile('progress.md'), 5);

  const aiAttribution = attributeAICosts(stories, costByBranch);
  const costs = {};
  for (const story of stories) {
    costs[story.id] = {
      projectedUsd: computeProjectedCost(story.estimate, HOURS, RATE),
      aiCostUsd: aiAttribution[story.id] ? aiAttribution[story.id].costUsd : 0,
      inputTokens: aiAttribution[story.id] ? aiAttribution[story.id].inputTokens : 0,
      outputTokens: aiAttribution[story.id] ? aiAttribution[story.id].outputTokens : 0,
    };
  }
  costs._totals = aiAttribution._totals || { costUsd: 0, inputTokens: 0, outputTokens: 0 };

  const atRisk = detectAtRisk(stories, testCases, bugs);
  const generatedAt = new Date().toISOString();
  const commitSha = getCommitSha();

  const sessionTimeline = [...costRows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce((acc, row) => {
      const prev = acc.length ? acc[acc.length - 1].cumCost : 0;
      acc.push({ date: row.date, cumCost: parseFloat((prev + row.costUsd).toFixed(4)) });
      return acc;
    }, []);

  const data = { epics, stories, tasks, testCases, bugs, costs, atRisk, coverage, recentActivity, generatedAt, commitSha, sessionTimeline };

  const jsonPath = path.join(ROOT, 'Docs', 'plan-status.json');
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[generate-plan] Written ${jsonPath}`);

  const html = renderHtml(data);
  const htmlPath = path.join(ROOT, 'Docs', 'plan-status.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`[generate-plan] Written ${htmlPath}`);
  console.log(`[generate-plan] Done. ${epics.length} epics, ${stories.length} stories, ${testCases.length} TCs, ${bugs.length} bugs.`);
}

main();
