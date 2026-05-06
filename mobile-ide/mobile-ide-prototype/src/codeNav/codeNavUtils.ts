const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.swift', '.kt', '.java',
  '.c', '.cpp', '.h', '.cs', '.rb', '.php',
  '.json', '.yaml', '.yml', '.toml', '.md',
  '.css', '.scss', '.html',
]);

export function isCodeFile(filePath: string): boolean {
  const dot = filePath.lastIndexOf('.');
  if (dot === -1) return false;
  return CODE_EXTENSIONS.has(filePath.slice(dot));
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
