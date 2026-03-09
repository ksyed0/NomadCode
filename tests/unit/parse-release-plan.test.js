'use strict';
const path = require('path');
const fs = require('fs');
const { parseReleasePlan } = require('../../tools/lib/parse-release-plan');

const fixture = fs.readFileSync(
  path.join(__dirname, '../fixtures/RELEASE_PLAN.md'), 'utf8'
);

describe('parseReleasePlan', () => {
  let result;
  beforeAll(() => { result = parseReleasePlan(fixture); });

  describe('epics', () => {
    it('extracts two epics', () => expect(result.epics).toHaveLength(2));
    it('parses epic ID', () => expect(result.epics[0].id).toBe('EPIC-0001'));
    it('parses epic title', () => expect(result.epics[0].title).toBe('Code Editing'));
    it('parses epic status', () => expect(result.epics[0].status).toBe('In Progress'));
    it('parses epic releaseTarget', () => expect(result.epics[0].releaseTarget).toBe('MVP (v0.1)'));
    it('parses epic dependencies as array', () => expect(result.epics[0].dependencies).toEqual([]));
    it('parses EPIC-0002 dependencies', () => expect(result.epics[1].dependencies).toEqual(['EPIC-0001']));
  });

  describe('stories', () => {
    it('extracts two stories', () => expect(result.stories).toHaveLength(2));
    it('parses story ID', () => expect(result.stories[0].id).toBe('US-0001'));
    it('parses story epicId', () => expect(result.stories[0].epicId).toBe('EPIC-0001'));
    it('parses story title', () => expect(result.stories[0].title).toMatch(/open a file/));
    it('parses story priority', () => expect(result.stories[0].priority).toBe('P0'));
    it('parses story estimate', () => expect(result.stories[0].estimate).toBe('M'));
    it('parses story status', () => expect(result.stories[0].status).toBe('In Progress'));
    it('parses story branch', () => expect(result.stories[0].branch).toBe('feature/US-0001-open-file'));
    it('parses ACs', () => expect(result.stories[0].acs).toHaveLength(2));
    it('parses AC id', () => expect(result.stories[0].acs[0].id).toBe('AC-0001'));
    it('parses AC text', () => expect(result.stories[0].acs[0].text).toBe('File picker opens'));
    it('parses AC done=false', () => expect(result.stories[0].acs[0].done).toBe(false));
    it('parses AC done=true', () => expect(result.stories[0].acs[1].done).toBe(true));
    it('empty branch is empty string', () => expect(result.stories[1].branch).toBe(''));
  });

  describe('tasks', () => {
    it('extracts one task', () => expect(result.tasks).toHaveLength(1));
    it('parses task ID', () => expect(result.tasks[0].id).toBe('TASK-0001'));
    it('parses task storyId', () => expect(result.tasks[0].storyId).toBe('US-0001'));
    it('parses task status', () => expect(result.tasks[0].status).toBe('To Do'));
    it('parses task branch', () => expect(result.tasks[0].branch).toBe('feature/US-0001-open-file'));
  });
});
