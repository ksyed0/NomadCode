# EPIC-0010: AI Suggestions — Design Spec

**Date:** 2026-05-01
**Epic:** EPIC-0010
**User Stories:** US-0033, US-0034, US-0035
**Release Target:** Release 1.0 (GA)
**Dependencies:** EPIC-0009 (IAP), EPIC-0008 (Git)
**Status:** Approved — ready for implementation planning

---

## 1. Overview

EPIC-0010 delivers AI-powered inline code completions and a chat panel to NomadCode, gated behind the Pro+AI subscription tier. It is the final major feature before v1.0 GA.

**Developer-pays model:** NomadCode pays Anthropic/Google/Moonshot directly for API usage. Users get AI features as part of their Pro+AI subscription ($14.99/mo). A shared 15¢/day per-user cap prevents runaway cost. Custom-provider users (own API key) bypass the cap entirely.

---

## 2. User Stories & Acceptance Criteria

### US-0033 — Inline code completions (Pro+AI only)
- **AC-0091:** Ghost-text completions appear after a 300 ms debounce while typing
- **AC-0092:** Tab accepts the current completion; Escape dismisses it (Monaco built-in)
- **AC-0093:** Completions are only triggered for Pro+AI subscribers; other users see no ghost text and no API calls are made

### US-0034 — AI chat panel (Pro+AI only)
- **AC-0094:** A chat panel opens via the "✦ AI" sidebar tab alongside the editor
- **AC-0095:** User can type a prompt referencing the current file and receive a streamed response
- **AC-0096:** Chat history persists for the session and is cleared on app restart

### US-0035 — Non-subscriber paywall
- **AC-0097:** Free and Pro users see an inline paywall when opening the AI chat tab
- **AC-0098:** AI ghost text is completely hidden for Free and Pro tier users (no API calls, no UI indication)

---

## 3. Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| API cost model | Developer-pays (EAS secrets) | Clean App Store story; Anthropic ToS compliant at this stage; power users don't need their own account |
| Streaming | `@microsoft/fetch-event-source` | Battle-tested SSE for RN; handles reconnection, abort, error events; ~4 KB |
| Chat panel placement | Left sidebar tab ("✦ AI") | Consistent with existing Files / Git / Search tab pattern; editor stays full-width |
| Context sent per request | Active file only | Bounded cost; `@file` references deferred to EPIC-0025 |
| Architecture | Zustand store + service layer | Mirrors `iapService` + `useSubscriptionStore` pattern from EPIC-0009 |
| Provider support | Claude (default), Gemini 3 Flash, Kimi K2.6, Custom | Multi-provider abstraction now; EPIC-0023 adds UI for switching |
| Cross-provider quota | Shared dollar daily cap (15¢/day) | Provider-agnostic; prevents gaming the limit by switching providers |
| Custom provider quota | No cap, session token tracking | User's own key and cost; tracked for their awareness only |

---

## 4. Architecture

### 4.1 New Files

```
src/ai/
  aiProvider.ts              # AIProvider interface, ChatMessage type, ProviderId union
  quotaConfig.ts             # All AI constants (cap, token limits, trim lengths)
  providerRegistry.ts        # getProvider() factory
  providers/
    claudeProvider.ts        # Anthropic — Haiku 4.5 completions, Sonnet 4.6 chat
    geminiProvider.ts        # Google — Gemini 3 Flash for both
    kimiProvider.ts          # Moonshot — Kimi K2.6 (OpenAI-compatible)
    customProvider.ts        # User-configured OpenAI-compatible endpoint

src/stores/
  useAIStore.ts              # Zustand store — quota, conversation, provider selection

src/components/
  AIChatPanel.tsx            # Chat UI rendered in the sidebar AI tab
  PaywallAISheet.tsx         # Inline paywall for Free/Pro users
```

### 4.2 Modified Files

| File | Change |
|---|---|
| `src/utils/MonacoAssetManager.ts` | Add `registerInlineCompletionsProvider`; add `SET_INLINE_COMPLETION` message case; add `COMPLETION_CONTEXT` outbound message |
| `src/components/Editor.tsx` | Add `injectMessage(payload: object): void` to `EditorHandle` interface and implementation |
| `src/components/FileExplorer.tsx` | Add `'ai'` to `SidebarTab` union type; render `AIChatPanel` / `PaywallAISheet` for AI tab |
| `App.tsx` | `COMPLETION_CONTEXT` handler with `completionRequestRef`; AI store init; AI tab wiring |
| `src/components/SettingsScreen.tsx` | AI Settings section — provider dropdown, custom-only fields, SecureStore key write |
| `.env.example` | Document `EXPO_PUBLIC_CLAUDE_API_KEY`, `EXPO_PUBLIC_GEMINI_API_KEY`, `EXPO_PUBLIC_KIMI_API_KEY` |

### 4.3 Models Used

| Task | Claude | Gemini | Kimi | Custom |
|---|---|---|---|---|
| Inline completions | `claude-haiku-4-5-20251001` | `gemini-3-flash` | `kimi-k2.6` | user-defined |
| AI chat | `claude-sonnet-4-6` | `gemini-3-flash` | `kimi-k2.6` | user-defined |

### 4.4 API Key Delivery

Built-in provider keys injected at build time via EAS secrets as env vars:
- `EXPO_PUBLIC_CLAUDE_API_KEY`
- `EXPO_PUBLIC_GEMINI_API_KEY`
- `EXPO_PUBLIC_KIMI_API_KEY`

Keys are never committed to source and never rendered in the app UI. Custom provider keys stored exclusively via `expo-secure-store` under the key `'nomadcode_custom_ai_key'`.

---

## 5. `AIProvider` Interface

**File:** `src/ai/aiProvider.ts`

```typescript
export type ProviderId = 'claude' | 'gemini' | 'kimi' | 'custom';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIProvider {
  id: ProviderId;
  displayName: string;
  streamChat(
    messages: ChatMessage[],
    fileContent: string,
    language: string,
    signal: AbortSignal,
    onChunk: (text: string) => void
  ): Promise<void>;
  getCompletion(
    prefix: string,
    suffix: string,
    language: string,
    signal: AbortSignal
  ): Promise<string>;
  estimateCostCents(inputTokens: number, outputTokens: number): number;
}
```

**`providerRegistry.ts`:**
```typescript
export function getProvider(id: ProviderId, customConfig?: CustomConfig): AIProvider {
  switch (id) {
    case 'claude':  return claudeProvider;
    case 'gemini':  return geminiProvider;
    case 'kimi':    return kimiProvider;
    case 'custom':  return buildCustomProvider(customConfig!);
    default:        return claudeProvider;
  }
}
```

---

## 6. `quotaConfig.ts`

```typescript
export const DAILY_CAP_CENTS         = 15;    // 15¢/day per user (built-in providers)
export const COMPLETION_MAX_TOKENS   = 256;
export const CHAT_MAX_TOKENS         = 2048;
export const COMPLETION_PREFIX_CHARS = 1500;   // trim prefix to last N chars
export const COMPLETION_SUFFIX_CHARS = 500;    // trim suffix to first N chars
```

`DAILY_CAP_CENTS` can be overridden via EAS variable at build time without a store migration.

---

## 7. `useAIStore`

**File:** `src/stores/useAIStore.ts`

```typescript
interface AIState {
  // ── Persisted (AsyncStorage via Zustand persist) ──────────────────────────
  selectedProviderId: ProviderId;
  customConfig: {
    baseUrl: string;
    modelName: string;
    contextWindowSize: number;   // tokens; used to trim file context for custom providers
    apiKeyIsStored: boolean;     // flag only — actual key lives in expo-secure-store
  };
  dailySpendCents: number;
  quotaResetDate: string;        // ISO date YYYY-MM-DD

  // ── Session only (not persisted — clears on restart, satisfies AC-0096) ───
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  abortController: AbortController | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  sendMessage(userText: string, fileContent: string, language: string): Promise<void>;
  cancelStream(): void;
  clearHistory(): void;
  checkAndResetQuota(): void;
  getActiveProvider(): AIProvider;
}
```

**Quota selector** (outside store, no persistence):
```typescript
export const selectIsOverQuota = (s: AIState): boolean =>
  s.selectedProviderId !== 'custom' &&
  s.dailySpendCents >= DAILY_CAP_CENTS;
```

**`checkAndResetQuota`:**
```typescript
checkAndResetQuota() {
  const today = new Date().toISOString().slice(0, 10);
  if (get().quotaResetDate !== today) {
    set({ dailySpendCents: 0, quotaResetDate: today });
  }
}
```

**Two-step quota accounting:**
1. **Pre-flight:** rough estimate `(inputChars / 4 × inputRate) + (COMPLETION_MAX_TOKENS × outputRate)` → block if `dailySpendCents + estimate > DAILY_CAP_CENTS`
2. **Post-request:** update `dailySpendCents` with actual token counts from API response metadata

Custom provider: `estimateCostCents` always returns 0 → never blocked, tracked for awareness only.

---

## 8. Data Flow

### 8.1 Chat message

```
User → AIChatPanel.onSend(text)
  → useAIStore.sendMessage(text, fileContent, language)
    → checkAndResetQuota()
    → if selectIsOverQuota() && provider !== 'custom' → push quota-error message, return
    → set({ isStreaming: true, abortController: new AbortController() })
    → pre-flight cost estimate → if over cap → push quota-error message, return
    → getActiveProvider().streamChat(messages, fileContent, language, signal, onChunk)
        → fetch-event-source → provider API (Anthropic / Google / Moonshot / Custom)
          → onChunk → set({ streamingText: prev + chunk }) → AIChatPanel re-renders
    → on complete → push full message to messages[], clear streamingText
    → post-request → dailySpendCents += actualCost (from response metadata)
    → set({ isStreaming: false, abortController: null })
```

### 8.2 Inline completion

```
User types
  → Monaco onDidChangeModelContent
    → post({ type: 'COMPLETION_CONTEXT', prefix, suffix, language })
      → App.tsx COMPLETION_CONTEXT handler
        → if !hasAIAccess(tier) → return (AC-0098: silent skip, no timer started)
        → abort in-flight completion (completionRequestRef.current?.abort.abort())
        → clearTimeout(completionRequestRef.current?.timer)
        → new AbortController
        → setTimeout(300ms, async () => {
            → if selectIsOverQuota() → return (silent skip)
            → prefix.slice(-COMPLETION_PREFIX_CHARS), suffix.slice(0, COMPLETION_SUFFIX_CHARS)
            → getActiveProvider().getCompletion(prefix, suffix, language, signal)
                → provider API → returns completion string (non-streamed, max 256 tokens)
            → if !signal.aborted →
                editorRef.current?.injectMessage({ type: 'SET_INLINE_COMPLETION', text })
          })
        → completionRequestRef.current = { timer, abort }

  WebView receives SET_INLINE_COMPLETION
    → pendingCompletion = text
    → editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {})
      → registerInlineCompletionsProvider.provideInlineCompletions()
          → returns { items: [{ insertText: pendingCompletion, range: cursorRange }] }
            → Monaco renders ghost text
              → Tab → accept (Monaco built-in, AC-0092)
              → Escape → dismiss (Monaco built-in, AC-0092)

  New COMPLETION_CONTEXT → pendingCompletion = null (stale ghost text cleared)
```

**Race condition handling:** Each new `COMPLETION_CONTEXT` message aborts the in-flight request via `AbortController` before starting a new one. `pendingCompletion` is cleared when a new `COMPLETION_CONTEXT` arrives, not when the provider reads it — prevents premature dismissal on Monaco re-queries.

---

## 9. Completion Prompt (FIM)

All providers use a fill-in-the-middle system prompt via the chat API:

```
System:
You are a code completion engine. Given a code prefix and suffix,
return ONLY the text to insert at the cursor. No explanation, no markdown,
no code fences. If no meaningful completion is appropriate, return an empty string.

User:
Language: {language}
<prefix>{trimmedPrefix}</prefix>
<suffix>{trimmedSuffix}</suffix>
```

- `max_tokens: 256`, temperature: 0 for all providers
- Custom provider: same OpenAI-compatible payload
- Empty string response → `SET_INLINE_COMPLETION` with `text: ''` → provider returns `{ items: [] }` → no ghost text

---

## 10. Prompt Caching

For chat requests (Claude only — Anthropic's caching API):

- **System prompt** (static): always cache breakpoint → ~90% cost reduction after first request
- **File context**: cache if content unchanged between consecutive requests in the same session
- Completions: not cached (each request has unique prefix/suffix)

Cache breakpoints injected by `claudeProvider.ts` using Anthropic's `cache_control` parameter on the system and file context blocks.

---

## 11. AIChatPanel Component

**File:** `src/components/AIChatPanel.tsx`

**Props:**
```typescript
interface AIChatPanelProps {
  activeFilePath: string | null;
  activeFileContent: string;
  activeFileLanguage: string;
}
```

**UI elements:**
- Sidebar tab bar (shared, rendered by `FileExplorer`) — "Files", "Git", "✦ AI"
- Panel header: "AI Chat" label + current filename as context indicator + daily spend chip + clear history (⌫) button
- Message list: scrollable `FlatList`, right-aligned user bubbles (navy), left-aligned assistant bubbles (slate) with inline code formatting
- Streaming indicator: `● Responding…` in header + blinking cursor at end of partial response + red `■ Stop` button
- Input: multiline `TextInput` + teal send button (disabled while streaming)
- Quota error: rendered as an inline error message bubble, not a modal
- Provider label in assistant bubbles: `✦ Claude` / `◈ Gemini` / `◉ Kimi` / `⚙ Custom`

**Spend chip:** shows `X.Xc` running total in the header. Tapping shows a tooltip: `X.Xc used today / 15¢ daily cap`. For custom provider: shows session token count instead, labelled "no cap".

---

## 12. PaywallAISheet Component

**File:** `src/components/PaywallAISheet.tsx`

Rendered in the AI tab slot for Free and Pro users. Not a modal — fills the full sidebar panel body.

**UI:**
- Lock icon (🔒) in a rounded tile
- "Pro+AI Feature" heading
- Description: "AI chat and inline completions are included in the Pro+AI plan."
- Feature list: inline completions, AI chat, 3 provider choices, custom model support
- Teal "Upgrade to Pro+AI" CTA → calls `onUpgrade` prop → opens existing `PaywallSheet` from EPIC-0009
- Price line: `$14.99/mo · $119.99/yr`

**Prop:**
```typescript
interface PaywallAISheetProps { onUpgrade: () => void; }
```

---

## 13. Settings Screen — AI Settings Section

Added to `SettingsScreen.tsx` below existing settings.

**Section header:** "AI SETTINGS" (teal uppercase label, matching existing section style)

**Daily usage bar** (built-in providers): progress bar showing `X.Xc / 15¢`, reset note. Hidden for custom provider; replaced with session token count.

**Provider dropdown:** Tapping opens an ActionSheet / modal picker with 4 options:
- `✦ Claude` — "Haiku 4.5 completions · Sonnet 4.6 chat"
- `◈ Gemini 3 Flash` — "Fast · 1M context · reasoning built-in"
- `◉ Kimi K2.6` — "Cost-efficient · OpenAI-compatible"
- `⚙ Custom model…` — "Your own key · local LLM · no usage cap" (dashed border)

**Built-in provider selected:** shows read-only model pills (e.g. "Haiku 4.5" / "Sonnet 4.6"). No keys, no URLs shown.

**Custom model selected — additional fields (animated-in):**
- Base URL (text input, e.g. `http://localhost:11434/v1`)
- API Key (secure text input, optional — stored via `SecureStore.setItemAsync('nomadcode_custom_ai_key', value)`)
- Model name (text input, e.g. `llama3.2`)
- Context window size (numeric input, default 4096)
- Footer note: "Requires OpenAI-compatible endpoint · key stored in device keychain"

**Inline completions toggle:** present for all providers.

---

## 14. `MonacoAssetManager.ts` Changes

Three additions inside `buildMonacoHtml`, within the `bootEditor` function:

### 14.1 `COMPLETION_CONTEXT` outbound message
Added inside `editor.onDidChangeModelContent`:
```js
var pos = editor.getPosition();
if (pos) {
  var content = editor.getValue();
  var offset = model.getOffsetAt(pos);
  post({
    type: 'COMPLETION_CONTEXT',
    prefix: content.slice(0, offset),
    suffix: content.slice(offset),
    language: currentLanguage,
  });
}
```

### 14.2 `registerInlineCompletionsProvider`
```js
var pendingCompletion = null;

monaco.languages.registerInlineCompletionsProvider({ pattern: '**' }, {
  provideInlineCompletions: function (model, position) {
    if (!pendingCompletion) return { items: [] };
    return {
      items: [{
        insertText: pendingCompletion,
        range: new monaco.Range(
          position.lineNumber, position.column,
          position.lineNumber, position.column
        )
      }]
    };
  },
  freeInlineCompletions: function () {}
});
```

### 14.3 `SET_INLINE_COMPLETION` message case
```js
case 'SET_INLINE_COMPLETION': {
  pendingCompletion = data.text || null;
  if (pendingCompletion) {
    editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {});
  }
  break;
}
```

`pendingCompletion` is cleared when a new `COMPLETION_CONTEXT` arrives (via `SET_INLINE_COMPLETION` with empty text), not when the provider reads it.

---

## 15. `Editor.tsx` — `EditorHandle` Addition

```typescript
export interface EditorHandle {
  // ... existing methods (toggleBlame, foldAll, unfoldAll, etc.)
  injectMessage(payload: object): void;
}

// Implementation (inside forwardRef):
injectMessage: (payload: object) => {
  webViewRef.current?.injectJavaScript(
    `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(JSON.stringify(payload))} }));`
  );
},
```

---

## 16. `App.tsx` Changes

```typescript
// Ref holds both the debounce timer and the in-flight abort controller
const completionRequestRef = useRef<{
  timer: ReturnType<typeof setTimeout>;
  abort: AbortController;
} | null>(null);

// Inside WebView onMessage handler:
case 'COMPLETION_CONTEXT': {
  if (!hasAIAccess(subscriptionTier)) break;  // AC-0098 — silent skip

  // Cancel in-flight request and clear timer
  completionRequestRef.current?.abort.abort();
  clearTimeout(completionRequestRef.current?.timer);

  // Clear stale ghost text immediately
  editorRef.current?.injectMessage({ type: 'SET_INLINE_COMPLETION', text: '' });

  const abort = new AbortController();
  const { prefix, suffix, language } = data;

  const timer = setTimeout(async () => {
    try {
      const aiStore = useAIStore.getState();
      if (selectIsOverQuota(aiStore)) return;  // soft-skip, no error shown

      const trimmedPrefix = prefix.slice(-COMPLETION_PREFIX_CHARS);
      const trimmedSuffix = suffix.slice(0, COMPLETION_SUFFIX_CHARS);

      const text = await aiStore.getActiveProvider()
        .getCompletion(trimmedPrefix, trimmedSuffix, language, abort.signal);

      if (!abort.signal.aborted) {
        editorRef.current?.injectMessage({ type: 'SET_INLINE_COMPLETION', text });
      }
    } catch {
      // completion failures are always silent — never interrupt typing
    }
  }, 300);

  completionRequestRef.current = { timer, abort };
  break;
}
```

---

## 17. Testing Strategy

Minimum 80% coverage on all new/modified files per CLAUDE.md.

| Test file | Key cases |
|---|---|
| `useAIStore.test.ts` | Quota resets on new day; `sendMessage` happy path streams chunks; quota exceeded blocks built-in providers; custom provider bypasses cap; `checkAndResetQuota` is idempotent; `cancelStream` aborts controller |
| `claudeProvider.test.ts` | `streamChat` chunks arrive via mocked SSE; `getCompletion` returns trimmed string; `estimateCostCents` correct for Haiku and Sonnet rates; empty response handled gracefully |
| `geminiProvider.test.ts` | Same shape as Claude; Gemini 3 Flash endpoint called |
| `kimiProvider.test.ts` | OpenAI-compatible endpoint; same shape |
| `customProvider.test.ts` | Reads key from `SecureStore` mock; calls configured `baseUrl`; `estimateCostCents` always returns 0 |
| `AIChatPanel.test.tsx` | Renders message list; send disabled while streaming; Stop fires `cancelStream`; clear history empties messages; quota-error bubble renders; spend chip shows correct value |
| `PaywallAISheet.test.tsx` | Renders for Free tier; renders for Pro tier; Upgrade CTA fires `onUpgrade` |
| `SettingsScreen.test.tsx` | Custom fields hidden for built-in provider; custom fields visible when Custom selected; provider change updates store; SecureStore called on key input |
| `MonacoAssetManager.test.ts` | `SET_INLINE_COMPLETION` sets `pendingCompletion`; `COMPLETION_CONTEXT` outbound message contains prefix/suffix/language |

---

## 18. AC Traceability

| AC | Satisfied by |
|---|---|
| AC-0091 | 300ms debounce in `App.tsx` COMPLETION_CONTEXT handler |
| AC-0092 | Monaco built-in Tab/Escape behaviour via `registerInlineCompletionsProvider` |
| AC-0093 | `hasAIAccess(tier)` check as first gate in COMPLETION_CONTEXT handler |
| AC-0094 | "✦ AI" tab in `FileExplorer` sidebar tab bar |
| AC-0095 | `useAIStore.sendMessage` → `streamChat` → SSE → `onChunk` → `AIChatPanel` re-render |
| AC-0096 | `messages` and `streamingText` excluded from Zustand `persist` middleware |
| AC-0097 | `PaywallAISheet` rendered in AI tab slot for Free/Pro tiers |
| AC-0098 | `hasAIAccess` check breaks out of COMPLETION_CONTEXT before any timer is started |
