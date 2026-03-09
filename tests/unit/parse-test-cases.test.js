'use strict';
const path = require('path');
const fs = require('fs');
const { parseTestCases } = require('../../tools/lib/parse-test-cases');

const fixture = fs.readFileSync(
  path.join(__dirname, '../fixtures/TEST_CASES.md'), 'utf8'
);

describe('parseTestCases', () => {
  let result;
  beforeAll(() => { result = parseTestCases(fixture); });

  it('extracts one test case', () => expect(result).toHaveLength(1));
  it('parses TC id', () => expect(result[0].id).toBe('TC-0001'));
  it('parses title', () => expect(result[0].title).toMatch(/File picker/));
  it('parses relatedStory', () => expect(result[0].relatedStory).toBe('US-0001'));
  it('parses relatedTask', () => expect(result[0].relatedTask).toBe('TASK-0001'));
  it('parses relatedAC', () => expect(result[0].relatedAC).toBe('AC-0001'));
  it('parses type', () => expect(result[0].type).toBe('Functional'));
  it('parses status as Not Run', () => expect(result[0].status).toBe('Not Run'));
  it('parses defect as None', () => expect(result[0].defect).toBe('None'));
});
