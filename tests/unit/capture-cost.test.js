'use strict';
const { buildRow } = require('../../tools/capture-cost');

const DATE = '2026-03-27';
const BRANCH = 'bugfix/BUG-0031-stop-hook';

describe('buildRow — full payload (Claude Code ≥ version with cost data)', () => {
  const data = {
    session_id: 'sess_abc123',
    cost_usd: 1.2345,
    usage: {
      input_tokens: 50000,
      output_tokens: 14000,
      cache_read_input_tokens: 8000,
    },
  };

  it('hasData is true when cost and tokens are present', () => {
    const { hasData } = buildRow(data, BRANCH, DATE);
    expect(hasData).toBe(true);
  });

  it('session_id has no [NO_DATA] tag', () => {
    const { row } = buildRow(data, BRANCH, DATE);
    expect(row).not.toContain('[NO_DATA]');
  });

  it('row contains formatted cost', () => {
    const { row } = buildRow(data, BRANCH, DATE);
    expect(row).toContain('1.2345');
  });

  it('row contains input/output/cache token counts', () => {
    const { row } = buildRow(data, BRANCH, DATE);
    expect(row).toContain('50000');
    expect(row).toContain('14000');
    expect(row).toContain('8000');
  });

  it('row contains branch and date', () => {
    const { row } = buildRow(data, BRANCH, DATE);
    expect(row).toContain(BRANCH);
    expect(row).toContain(DATE);
  });

  it('row uses total_cost as fallback when cost_usd absent', () => {
    const d = { session_id: 'sess_x', total_cost: 0.5, usage: { input_tokens: 1000, output_tokens: 200 } };
    const { row, hasData } = buildRow(d, BRANCH, DATE);
    expect(hasData).toBe(true);
    expect(row).toContain('0.5000');
  });
});

describe('buildRow — empty payload (older Claude Code, no cost fields)', () => {
  const data = { session_id: 'sess_old', stop_hook_active: true };

  it('hasData is false', () => {
    const { hasData } = buildRow(data, BRANCH, DATE);
    expect(hasData).toBe(false);
  });

  it('session_id is tagged [NO_DATA]', () => {
    const { row } = buildRow(data, BRANCH, DATE);
    expect(row).toContain('sess_old [NO_DATA]');
  });

  it('cost is 0.0000', () => {
    const { row } = buildRow(data, BRANCH, DATE);
    expect(row).toContain('0.0000');
  });

  it('all token columns are 0', () => {
    const { row } = buildRow(data, BRANCH, DATE);
    // Expect "| 0 | 0 | 0 |" somewhere in the row
    expect(row).toMatch(/\| 0 \| 0 \| 0 \|/);
  });
});

describe('buildRow — completely empty payload (parse failure)', () => {
  it('generates a sess_<timestamp> id tagged [NO_DATA]', () => {
    const { row, hasData } = buildRow({}, BRANCH, DATE);
    expect(hasData).toBe(false);
    expect(row).toContain('[NO_DATA]');
    expect(row).toMatch(/sess_\d+/);
  });
});

describe('buildRow — tokens present but cost absent', () => {
  it('hasData is true when only tokens are present', () => {
    const data = { session_id: 'sess_tok', usage: { input_tokens: 5000, output_tokens: 1000 } };
    const { hasData } = buildRow(data, BRANCH, DATE);
    expect(hasData).toBe(true);
  });

  it('cost is 0.0000 but no [NO_DATA] tag', () => {
    const data = { session_id: 'sess_tok', usage: { input_tokens: 5000, output_tokens: 1000 } };
    const { row } = buildRow(data, BRANCH, DATE);
    expect(row).not.toContain('[NO_DATA]');
    expect(row).toContain('0.0000');
  });
});
