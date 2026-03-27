/**
 * djb2 hash — fast, dependency-free string hashing for conflict detection.
 *
 * Used when file mtime is unavailable (Android SAF paths): we hash the file
 * content at open time and compare against the current on-disk content when
 * the app returns to the foreground.
 *
 * Not cryptographic — only used for change-detection equality checks.
 * 32-bit hash space (~4 billion values): collision probability is negligible for
 * typical source files but non-zero for very large files. Do not use for security.
 */
export function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep as unsigned 32-bit
  }
  return hash.toString(16);
}
