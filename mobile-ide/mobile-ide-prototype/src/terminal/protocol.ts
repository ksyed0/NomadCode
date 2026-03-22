/**
 * Messages sent from React Native → WebView.
 */
export type RNToWebView =
  | { type: 'FILE_RESULT'; requestId: string; result: string | null; error?: string }
  | { type: 'RESIZE'; cols: number; rows: number }
  | { type: 'SET_CWD'; cwd: string };

/**
 * Messages sent from WebView → React Native.
 */
export type WebViewToRN =
  | { type: 'FILE_READ';   requestId: string; path: string }
  | { type: 'FILE_WRITE';  requestId: string; path: string; content: string }
  | { type: 'FILE_LIST';   requestId: string; path: string }
  | { type: 'FILE_MKDIR';  requestId: string; path: string }
  | { type: 'FILE_DELETE'; requestId: string; path: string }
  | { type: 'COMMAND_COMPLETE'; exitCode: number };
