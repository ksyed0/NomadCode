/**
 * Shared GitHub HTTPS auth for isomorphic-git (OAuth token as username, x-oauth-basic).
 * Align with terminal bundle: onAuth returns { username: token, password: 'x-oauth-basic' }.
 */

export type OnAuth = (
  url: string,
  auth: { username?: string; password?: string },
) => Promise<{ username: string; password: string } | void>;

/**
 * Returns an onAuth callback when token is non-null; otherwise undefined (public HTTPS clone).
 */
export function createGithubOnAuth(token: string | null | undefined): OnAuth | undefined {
  if (!token || token.length === 0) return undefined;
  return async () => ({
    username: token,
    password: 'x-oauth-basic',
  });
}
