/**
 * Messages sent from React Native → WebView.
 */
export type RNToWebView =
  | { type: 'FILE_RESULT'; requestId: string; result: string | null; error?: string }
  | { type: 'TOKEN_RESULT'; requestId: string; token: string | null }
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
  | { type: 'FILE_COPY';   requestId: string; src: string; dest: string }
  | { type: 'FILE_MOVE';   requestId: string; src: string; dest: string }
  | { type: 'GET_TOKEN';   requestId: string }
  | { type: 'COMMAND_COMPLETE'; exitCode: number };
