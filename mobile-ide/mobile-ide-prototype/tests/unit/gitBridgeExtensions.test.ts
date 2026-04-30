// tests/unit/gitBridgeExtensions.test.ts
// Tests for the three new GitBridge methods added in EPIC-0020.

jest.mock('isomorphic-git');
jest.mock('expo-file-system/legacy');

import { GitBridge } from '../../src/git/gitBridge';
import * as git from 'isomorphic-git';
import * as ExpoFS from 'expo-file-system/legacy';

const mockResolveRef = git.resolveRef as jest.Mock;
const mockReadBlob = git.readBlob as jest.Mock;
const mockLog = git.log as jest.Mock;
const mockReadAsStringAsync = (ExpoFS as jest.Mocked<typeof ExpoFS>).readAsStringAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('GitBridge.readHeadFile', () => {
  it('returns file content from HEAD when file exists', async () => {
    mockResolveRef.mockResolvedValue('abc123');
    const encoder = new TextEncoder();
    mockReadBlob.mockResolvedValue({ blob: encoder.encode('head content') });

    const result = await GitBridge.readHeadFile('/repo', 'src/file.ts');
    expect(result).toBe('head content');
  });

  it('returns null when the file is not in HEAD (untracked)', async () => {
    mockResolveRef.mockResolvedValue('abc123');
    mockReadBlob.mockRejectedValue(new Error('not found'));

    const result = await GitBridge.readHeadFile('/repo', 'src/new.ts');
    expect(result).toBeNull();
  });
});

describe('GitBridge.hasConflicts', () => {
  it('returns true when file contains conflict markers', async () => {
    mockReadAsStringAsync.mockResolvedValue('line\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n');
    const result = await GitBridge.hasConflicts('/repo', 'src/file.ts');
    expect(result).toBe(true);
  });

  it('returns false for a clean file', async () => {
    mockReadAsStringAsync.mockResolvedValue('no conflicts here');
    const result = await GitBridge.hasConflicts('/repo', 'src/file.ts');
    expect(result).toBe(false);
  });
});

describe('GitBridge.blame', () => {
  it('returns an array of BlameLine with correct fields', async () => {
    const encoder = new TextEncoder();
    mockResolveRef.mockResolvedValue('def456');
    mockLog.mockResolvedValue([
      { oid: 'def456', commit: { author: { name: 'Alice', timestamp: 1700000000 }, message: 'fix thing\n' } },
    ]);
    mockReadBlob.mockResolvedValue({ blob: encoder.encode('line1\nline2') });

    const result = await GitBridge.blame('/repo', 'src/file.ts');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({
      lineNumber: expect.any(Number),
      commitHash: expect.any(String),
      author: 'Alice',
      timestamp: expect.any(Number),
      message: 'fix thing',
    });
  });

  it('returns empty array when file has no commit history', async () => {
    mockLog.mockResolvedValue([]);
    const result = await GitBridge.blame('/repo', 'src/new.ts');
    expect(result).toEqual([]);
  });
});
