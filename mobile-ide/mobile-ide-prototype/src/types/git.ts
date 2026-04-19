export interface ConflictHunk {
  index: number;
  ours: string[];
  theirs: string[];
}

export interface ConflictFile {
  path: string;
  hunks: ConflictHunk[];
}

export interface StashEntry {
  index: number;
  message: string;
  timestamp: number;
  fileCount: number;
  files: Record<string, string>; // path → content snapshot
}

export interface BlameLine {
  lineNumber: number;
  commitHash: string;
  author: string;
  timestamp: number;
  message: string;
}

export interface GutterDiff {
  added: number[];
  modified: number[];
  deleted: number[];
}
