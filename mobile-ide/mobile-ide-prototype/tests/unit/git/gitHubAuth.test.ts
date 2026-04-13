/**
 * Unit tests — gitHubAuth (GitHub HTTPS onAuth for isomorphic-git)
 */

import { createGithubOnAuth } from '../../../src/git/gitHubAuth';

describe('createGithubOnAuth', () => {
  it('returns undefined when token is null or empty', () => {
    expect(createGithubOnAuth(null)).toBeUndefined();
    expect(createGithubOnAuth(undefined)).toBeUndefined();
    expect(createGithubOnAuth('')).toBeUndefined();
  });

  it('returns callback that yields token + x-oauth-basic', async () => {
    const onAuth = createGithubOnAuth('gho_abc');
    expect(onAuth).toBeDefined();
    const creds = await onAuth!('https://github.com/o/r.git', {});
    expect(creds).toEqual({ username: 'gho_abc', password: 'x-oauth-basic' });
  });
});
