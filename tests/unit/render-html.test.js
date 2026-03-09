'use strict';
const { renderHtml } = require('../../tools/lib/render-html');

const sampleData = {
  epics: [{ id: 'EPIC-0001', title: 'Code Editing', status: 'In Progress', releaseTarget: 'MVP', dependencies: [] }],
  stories: [{ id: 'US-0001', epicId: 'EPIC-0001', title: 'Open a file', priority: 'P0', estimate: 'M', status: 'In Progress', branch: 'feature/US-0001', acs: [], dependencies: [] }],
  tasks: [],
  testCases: [],
  bugs: [],
  costs: { 'US-0001': { projectedUsd: 800, aiCostUsd: 0.47, inputTokens: 50000, outputTokens: 14000 }, _totals: { costUsd: 0.89, inputTokens: 95000, outputTokens: 26000 } },
  atRisk: { 'US-0001': { missingTCs: true, noBranch: false, failedTCNoBug: false, isAtRisk: true } },
  coverage: { lines: 84.5, overall: 81.0, meetsTarget: true },
  recentActivity: [{ date: '2026-03-10', summary: 'Implemented FileSystemBridge' }],
  generatedAt: '2026-03-10T12:00:00Z',
  commitSha: 'abc1234',
};

describe('renderHtml', () => {
  let html;
  beforeAll(() => { html = renderHtml(sampleData); });

  it('returns a string', () => expect(typeof html).toBe('string'));
  it('includes DOCTYPE', () => expect(html).toMatch(/<!DOCTYPE html>/));
  it('includes Tailwind CDN', () => expect(html).toMatch(/cdn\.tailwindcss\.com/));
  it('includes Chart.js CDN', () => expect(html).toMatch(/cdn\.jsdelivr\.net.*chart\.js/));
  it('includes project name', () => expect(html).toMatch(/NomadCode/));
  it('includes generated timestamp', () => expect(html).toMatch(/2026-03-10/));
  it('includes commit SHA', () => expect(html).toMatch(/abc1234/));
  it('includes total projected cost', () => expect(html).toMatch(/\$800/));
  it('includes coverage percent', () => expect(html).toMatch(/81/));
  it('includes epic filter option', () => expect(html).toMatch(/EPIC-0001/));
  it('includes all 6 tabs', () => {
    expect(html).toMatch(/Hierarchy/);
    expect(html).toMatch(/Kanban/);
    expect(html).toMatch(/Traceability/);
    expect(html).toMatch(/Charts/);
    expect(html).toMatch(/Costs/);
    expect(html).toMatch(/Bugs/);
  });
  it('marks at-risk story with warning', () => expect(html).toMatch(/at-risk|⚠/));
});
