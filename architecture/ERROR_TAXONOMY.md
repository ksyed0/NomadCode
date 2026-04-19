# Error taxonomy (NomadCode)

Structured classification for application and integration errors. User-facing strings stay human-readable; logs must not include tokens, credentials, or file contents from user projects.

| Class | Meaning | Examples |
| --- | --- | --- |
| `ValidationError` | Bad input or client-side preconditions | Empty clone URL, invalid workspace path |
| `IntegrationError` | External systems (Git HTTPS, network, OAuth provider) | HTTP 401/403, network timeout, offline |
| `BusinessLogicError` | Domain rules of git/workspace | Non-fast-forward pull, unsupported SAF workspace for git |
| `SystemError` | Unexpected internal failure | Bug, unhandled exception — rare |

Git operations in `src/git/networkRetry.ts` map transient network failures with exponential backoff; final errors passed to the UI are plain `Error` messages with a short context prefix (e.g. `Clone:`, `Push:`).
