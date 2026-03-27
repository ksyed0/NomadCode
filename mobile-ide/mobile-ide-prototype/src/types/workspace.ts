/**
 * Workspace types for EPIC-0012 Cloud Sync.
 *
 * NomadCode uses passive OS-native cloud sync: the user picks a folder
 * (iCloud Drive, OneDrive, Google Drive, etc.) and the OS handles sync.
 * This module defines the types shared across the sync layer.
 */

/** Distinguishes regular file:// paths from Android SAF content:// URIs. */
export type WorkspaceUriType = 'file' | 'saf';

/** Describes a user-selected workspace root directory. */
export interface WorkspaceRoot {
  /** Absolute URI — file:// on iOS, content:// on Android SAF. */
  uri: string;
  /** How to route file operations for this URI. */
  uriType: WorkspaceUriType;
  /** Human-readable label shown in Settings (e.g. "iCloud Drive › Projects"). */
  displayName: string;
}

/** Per-tab metadata recorded when a file is opened — used for conflict detection. */
export interface OpenTabMeta {
  path: string;
  /** Unix timestamp (ms) when the file was loaded from disk. */
  loadedAt: number;
  /** djb2 hash of content at load time; used when mtime is unavailable (SAF). */
  contentHash: string;
}

/** The three choices the user can make when a conflict is detected. */
export type ConflictResolution = 'keep-mine' | 'use-cloud' | 'keep-both';

/** Describes a detected conflict between the in-memory tab and the on-disk version. */
export interface ConflictInfo {
  tabPath: string;
  fileName: string;
  /** Content currently in the editor tab (possibly unsaved edits). */
  localContent: string;
  /** Content currently on disk (the cloud-synced version). */
  cloudContent: string;
}
