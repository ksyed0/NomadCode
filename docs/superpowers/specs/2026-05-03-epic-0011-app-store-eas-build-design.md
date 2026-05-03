# EPIC-0011 Design Spec — App Store & EAS Build Delivery
**Date:** 2026-05-03
**Author:** Claude Code (Session 20)
**Status:** Approved — ready for implementation planning

---

## 1. Overview

EPIC-0011 is the final v1.0 GA gate for NomadCode. It delivers:

1. A production EAS Build pipeline producing a valid iOS `.ipa` and Android `.aab`
2. iOS App Store submission via `eas submit --platform ios`
3. Google Play Store submission via `eas submit --platform android`
4. An OpenRouter migration replacing three separate AI provider implementations with a single unified provider, user-selectable model search, and live pricing from the OpenRouter models API
5. A BYOK (Bring Your Own Key) provider system supporting OpenRouter, Anthropic, Google, OpenAI, and custom OpenAI-compatible endpoints

All dependencies satisfied: EPIC-0005, EPIC-0007, EPIC-0008, EPIC-0009, EPIC-0010.

---

## 2. Scope & Work Streams

EPIC-0011 consists of four parallel work streams with explicit blocking dependencies noted:

| Stream | Stories | Blocked by | Can start |
|---|---|---|---|
| 1. OpenRouter Migration | New task within US-0036 | Nothing | ✅ Immediately |
| 2. Android Build + Submit | US-0036 + US-0038 | Google Play Console signup ($25) | ✅ After signup |
| 3. Store Metadata + Privacy Policy | US-0037 + US-0038 | Nothing | ✅ Immediately |
| 4. iOS Build + Submit | US-0036 + US-0037 | Apple Developer Program enrollment | ⏳ After enrollment clears |

### Current blockers

- **Apple Developer Program**: Identity verification failing — enrollment in progress. Will unblock iOS build + submit (Streams 1 and 4 for iOS). ETA: unknown.
- **Google Play Console**: Not yet enrolled ($25 one-time, no ID verification). Should resolve quickly.

### Version bump

`app.json` version `0.1.0` → `1.0.0`. `package.json` `0.1.3` → `1.0.0`. Both updated as part of this epic before the production build.

---

## 3. User Stories

### US-0036 — EAS Build Pipeline

`eas build --platform all --profile production` produces a valid iOS `.ipa` and Android `.aab` using EAS Managed credentials.

**Scope includes:**
- `eas.json` production profile fully configured (secrets, signing, auto-increment)
- `app.json` updated with Privacy Manifests, version 1.0.0, versionCode 1
- Three EAS secrets stored: `EXPO_PUBLIC_OPENROUTER_API_KEY`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- OpenRouter migration (replaces CLAUDE/GEMINI/KIMI keys — see Section 5)
- BYOK provider system (see Section 6)

### US-0037 — iOS App Store Submission

`eas submit --platform ios` submits to App Store Connect. Complete metadata, screenshots, and privacy policy URL in place before submission.

**Blocked by:** Apple Developer Program enrollment.

### US-0038 — Google Play Submission

`eas submit --platform android` submits to the Play Console internal track. Complete metadata, feature graphic, screenshots, and privacy policy URL in place.

---

## 4. EAS Configuration

### `eas.json` — final production profile

```json
{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_OPENROUTER_API_KEY": "EAS_SECRET",
        "EXPO_PUBLIC_REVENUECAT_IOS_KEY": "EAS_SECRET",
        "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY": "EAS_SECRET"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "<apple-id-email>",
        "ascAppId": "<app-store-connect-app-id>",
        "appleTeamId": "<team-id>"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

**Removed keys:** `EXPO_PUBLIC_CLAUDE_API_KEY`, `EXPO_PUBLIC_GEMINI_API_KEY`, `EXPO_PUBLIC_KIMI_API_KEY` — replaced by single `EXPO_PUBLIC_OPENROUTER_API_KEY`.

### `app.json` — additions required

```json
{
  "expo": {
    "version": "1.0.0",
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.nomadcode.mobileide",
      "buildNumber": "1",
      "infoPlist": {
        "NSFaceIDUsageDescription": "Used to secure your stored credentials"
      },
      "privacyManifests": {
        "NSPrivacyAccessedAPITypes": [
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
            "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]
          }
        ]
      }
    },
    "android": {
      "package": "com.nomadcode.mobileide",
      "versionCode": 1,
      "permissions": []
    }
  }
}
```

**Why Privacy Manifests:** Apple requires a `PrivacyInfo.xcprivacy` manifest (enforced since iOS 17.4) if the app or any SDK accesses `UserDefaults`, file timestamps, disk space, or system boot time. `expo-secure-store` accesses `UserDefaults` under the hood via its config plugin — without this declaration, App Store submission is rejected.

### Signing strategy: EAS Managed Credentials

Starting fresh (no existing Apple Distribution certificate or Android keystore), EAS Managed is the correct choice:
- EAS generates and stores the iOS Distribution cert + provisioning profile
- EAS generates and stores the Android upload keystore
- Credentials can be downloaded at any time via `eas credentials`
- Android uses Play App Signing — EAS's keystore is the upload key only; Google holds the actual signing key

### Secrets setup commands

```bash
# Run once from the mobile-ide/mobile-ide-prototype/ directory
eas secret:create --scope project --name EXPO_PUBLIC_OPENROUTER_API_KEY --value <key>
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value <key>
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value <key>
```

**Where to get keys:**
- `EXPO_PUBLIC_OPENROUTER_API_KEY`: openrouter.ai → Sign Up → Keys → Create key ($5 minimum credit)
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY`: app.revenuecat.com → New Project → iOS App → SDK Key
- `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`: Same RevenueCat project → Android App → SDK Key

### Build + submit commands

```bash
# Build both platforms (submits to EAS cloud build queue)
eas build --platform all --profile production

# Submit (run after stores are set up)
eas submit --platform android --profile production   # available now
eas submit --platform ios --profile production       # after Apple enrollment
```

---

## 5. OpenRouter Migration

### Rationale

Replaces three separate AI provider implementations (`claudeProvider.ts`, `geminiProvider.ts`, `kimiProvider.ts`) with a single `openRouterProvider.ts`. Benefits:
- One API key instead of three
- 200+ user-selectable models including free models
- Live pricing from OpenRouter's public models API (no hardcoded price table)
- Existing `customProvider.ts` pattern (OpenAI-compatible SSE) maps directly to OpenRouter's API

### Architecture

**New file:** `src/ai/providers/openRouterProvider.ts`
- Implements the existing `AIProvider` interface
- Base URL: `https://openrouter.ai/api/v1`
- Uses OpenAI-compatible SSE (`/chat/completions` with `stream: true`)
- Accepts `model` parameter (any valid OpenRouter model ID)
- Calculates `costCents` from `usage` tokens × model pricing from cache
- `costCents = 0` for free models (detected via `pricing.prompt === "0"`)

**New file:** `src/ai/openRouterModelsService.ts`
- Fetches `GET https://openrouter.ai/api/v1/models` (public endpoint, no auth required)
- Caches result in AsyncStorage with 24-hour TTL
- Returns `OpenRouterModel[]` with `id`, `name`, `description`, `context_length`, `pricing.prompt`, `pricing.completion`
- Falls back to cached list on network failure
- Returns empty array on first launch + offline (UI shows warning, selector disabled)

**Modified:** `src/ai/quotaConfig.ts`
- Remove `OPENROUTER_MODEL_PRICES` static map (pricing now comes from live API)
- Add `DEFAULT_PRICE_CENTS_PER_1K_TOKENS = 0.5` — conservative fallback for uncached/unknown models
- `DAILY_CAP_CENTS = 15` unchanged

**Modified:** `src/stores/useAIStore.ts`
- Replace `providerId: ProviderId` with `builtInModel: string` (OpenRouter model ID, e.g. `"anthropic/claude-3-5-haiku"`)
- Add `openRouterModels: OpenRouterModel[]` — hydrated from `openRouterModelsService`
- Add `modelPricingMap: Record<string, { prompt: string; completion: string }>` — derived from models list
- `byok` field (see Section 6)
- Session-only fields (`messages`, `streamingText`, `abortController`) remain excluded from persist

**Modified:** `src/ai/providerRegistry.ts`
- Built-in path: returns `openRouterProvider` with developer's key + `builtInModel`
- BYOK path: returns `byokProvider` with user's key + user's model (see Section 6)
- Remove references to `claudeProvider`, `geminiProvider`, `kimiProvider`

**Deleted:** `src/ai/providers/claudeProvider.ts`, `geminiProvider.ts`, `kimiProvider.ts`

### Quota logic with OpenRouter

```
if model.pricing.prompt === "0" && model.pricing.completion === "0":
    costCents = 0              → never touches daily cap (free model)
else:
    costCents = (promptTokens × inputPrice + completionTokens × outputPrice) / 10_000
    dailySpendCents += costCents
    if dailySpendCents >= DAILY_CAP_CENTS: block request
```

Free models are unlimited for Pro+AI subscribers. Paid models share the 15¢/day cap. Custom provider (BYOK) path: `costCents = 0`, no cap regardless of model.

### Quota bar UX (SettingsScreen.tsx)

| Model type | Quota bar display |
|---|---|
| Free model selected | "Unlimited · Free model" |
| Paid model selected | "12.3¢ remaining today" (live) |
| Models list loading | Spinner |
| Offline, cache empty | "Model list unavailable offline" |

---

## 6. BYOK — Bring Your Own Key

### Tier access

| Feature | Free | Pro ($7.99/mo) | Pro+AI ($14.99/mo) |
|---|---|---|---|
| Built-in AI (OpenRouter, developer-pays) | ❌ | ❌ | ✅ |
| BYOK (user's own key) | ❌ | ✅ | ✅ |
| Inline completions | ❌ | BYOK only | ✅ + BYOK |
| AI chat panel | ❌ | BYOK only | ✅ + BYOK |

Free users see `PaywallAISheet` for any AI entry point. The sheet needs a `reason` prop to distinguish the two paywall messages:
- `reason="builtin"` → "Upgrade to Pro+AI for built-in AI completions"
- `reason="byok"` → "Upgrade to Pro to use your own API key"

### Store schema (`useAIStore.ts`)

```typescript
byok: {
  enabled: boolean;
  preset: 'openrouter' | 'anthropic' | 'google' | 'openai' | 'custom';
  apiKey: string;         // stored in expo-secure-store (keychain), not persisted to AsyncStorage
  customEndpoint?: string; // only for 'custom' preset
  model: string;           // user-entered or selected
}
```

`apiKey` is stored in `expo-secure-store` only — never in Zustand's persisted AsyncStorage state. The store holds a `byokKeyConfigured: boolean` flag to indicate a key is present without exposing it.

### New file: `src/ai/providers/byokProvider.ts`

Replaces and supersedes `customProvider.ts`. Handles all five presets:

| Preset | Base URL | Auth header | Notes |
|---|---|---|---|
| `openrouter` | `https://openrouter.ai/api/v1` | `Authorization: Bearer <key>` | Full model catalog |
| `anthropic` | `https://api.anthropic.com/v1` | `x-api-key: <key>` | Needs `anthropic-version: 2023-06-01` header |
| `google` | `https://generativelanguage.googleapis.com/v1beta/openai` | `Authorization: Bearer <key>` | OpenAI-compatible mode |
| `openai` | `https://api.openai.com/v1` | `Authorization: Bearer <key>` | Reference implementation |
| `custom` | User-entered URL | `Authorization: Bearer <key>` | Any OpenAI-compatible endpoint |

All presets use the same OpenAI-compatible SSE parsing logic. Anthropic requires two extra headers; all others are identical. `costCents = 0` for all BYOK paths — it's the user's own spend.

**Delete:** `src/ai/providers/customProvider.ts` (superseded)

### Settings UI (SettingsScreen.tsx)

BYOK settings section visible only for Pro and Pro+AI users. Contains:
- Preset picker (5 options listed above)
- API key input (masked, stored to keychain on blur, cleared on preset change)
- Model input (text field; for `openrouter` preset, also shows a search selector)
- Custom endpoint URL field (visible only for `custom` preset)
- "Test connection" button — sends a minimal 1-token request to verify key + endpoint

---

## 7. Model Search Selector

A search-enabled model picker for both the built-in OpenRouter path and BYOK OpenRouter path.

**Component:** `src/components/ModelSearchSelector.tsx`

```typescript
interface Props {
  models: OpenRouterModel[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
  loading: boolean;
  disabled?: boolean;
}
```

**Behaviour:**
- Text input filters `models` by `id`, `name`, and description (case-insensitive)
- Free models (both `pricing.prompt` and `pricing.completion` are `"0"`) surfaced at top of list, marked with a **FREE** badge in `--nomad-code` blue
- Each row shows: model name, provider (parsed from `id` prefix), context window, cost per 1M tokens (or "FREE")
- Tapping a row sets `selectedModel` and closes the dropdown
- Virtualized list (FlatList) — OpenRouter has 200+ models
- No model restriction — users can select anything in the catalog

---

## 8. Store Metadata

### Privacy policy and support pages

Already created and committed to `docs/` on `develop`:
- `docs/privacy/index.html` → `https://ksyed0.github.io/NomadCode/privacy/`
- `docs/support/index.html` → `https://ksyed0.github.io/NomadCode/support/`
- `docs/.nojekyll` — disables Jekyll
- `docs/GITHUB_PAGES_SETUP.md` — step-by-step hosting instructions

GitHub Pages must be enabled on the repo (Settings → Pages → `develop` branch → `/docs` folder). See `docs/GITHUB_PAGES_SETUP.md`.

### iOS App Store metadata

| Field | Value |
|---|---|
| App Name | NomadCode |
| Subtitle | Code Editor for iPad & iPhone |
| Category (Primary) | Developer Tools |
| Category (Secondary) | Productivity |
| Age Rating | 4+ |
| Keywords | `code editor,IDE,programming,developer,git,terminal,iPad,coding,Python,JavaScript` |
| Support URL | `https://ksyed0.github.io/NomadCode/support/` |
| Privacy Policy URL | `https://ksyed0.github.io/NomadCode/privacy/` |

**App description:**

> Code from anywhere.
>
> NomadCode is a professional mobile IDE for iPad and iPhone. Write, run, and manage real code from your tablet or phone — no compromises.
>
> **Editor**
> Monaco-based code editor with syntax highlighting for 50+ languages, Prettier formatting, global search and replace, code folding, breadcrumb navigation, and hardware keyboard shortcuts.
>
> **Terminal**
> Integrated sandboxed terminal with POSIX commands, git, node, npm, and npx.
>
> **Git**
> Full GitHub integration — clone, stage, commit, push, pull, branch switching, conflict resolution, git blame, and stash management.
>
> **AI (Pro+AI)**
> Inline ghost-text completions and AI chat panel powered by 200+ models via OpenRouter. Free models are unlimited. Bring your own API key (Pro) to use Claude, Gemini, OpenAI, or any OpenAI-compatible endpoint.
>
> **Works offline.** Your code lives on your device.

### Google Play metadata

| Field | Value |
|---|---|
| App Name | NomadCode |
| Short Description | Professional code editor for Android tablets and phones |
| Category | Tools |
| Content Rating | Everyone |
| Privacy Policy URL | `https://ksyed0.github.io/NomadCode/privacy/` |
| Support Email | `support@fablesoft.biz` |

### Screenshots (5 screens × 3 iOS sizes + Android tablet)

Capture from simulators, wrap in device frames via AppLaunchpad (applaunchpad.com), overlay marketing copy using FableSoft design system colours (Deep Slate `#0F172A` bg, Nomad Blue `#2563EB` accent, Cloud `#E2E8F0` text).

| Screen | Content |
|---|---|
| 1 | Split-pane tablet view — editor + file explorer + terminal (hero shot) |
| 2 | AI chat panel with streaming response + model selector |
| 3 | Git panel — staged files, commit, branch picker |
| 4 | Command palette over editor |
| 5 | Settings screen — BYOK configuration |

**Required iOS sizes:**
- iPhone 6.7" (1290×2796) — at least 3 screenshots
- iPhone 6.5" (1242×2688) — at least 3 screenshots
- iPad Pro 13" (2048×2732) — at least 3 screenshots

**Required Android:**
- Feature graphic: 1024×500px
- Phone screenshots: min 2
- Tablet screenshots: min 2

**Capture commands:**
```bash
# iOS simulator screenshots
xcrun simctl io booted screenshot ~/Desktop/nomad-screen-1.png

# Android emulator screenshots
adb exec-out screencap -p > ~/Desktop/nomad-screen-1.png
```

---

## 9. Entitlements Review

Current `ios/NomadCode/NomadCode.entitlements` is an empty `<dict/>`. The following entitlements will be injected by Expo config plugins at `prebuild` time:

| Entitlement | Source | Apple review risk |
|---|---|---|
| `keychain-access-groups` | `expo-secure-store` plugin | Low — standard, well-understood |
| `com.apple.developer.associated-domains` | `expo-web-browser` (if deep links configured) | Low |

No background modes, push notifications, camera, microphone, location, or health kit access — NomadCode's entitlement surface is minimal. Apple review scrutiny should be low.

**Privacy Manifests** (required since iOS 17.4): `NSPrivacyAccessedAPICategoryUserDefaults` with reason `CA92.1` (required by `expo-secure-store`). Added to `app.json` as specified in Section 4.

---

## 10. Subscription Key Setup (RevenueCat)

RevenueCat keys can be obtained before the store accounts are fully configured:

1. Sign up at `app.revenuecat.com`
2. Create a new Project: "NomadCode"
3. Add iOS App → Bundle ID: `com.nomadcode.mobileide` → Copy **Public SDK Key** → store as `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
4. Add Android App → Package: `com.nomadcode.mobileide` → Copy **Public SDK Key** → store as `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
5. Configure Products (after store accounts are ready):
   - `nomadcode_pro_monthly` ($7.99/mo)
   - `nomadcode_pro_annual` ($59.99/yr)
   - `nomadcode_proai_monthly` ($14.99/mo)
   - `nomadcode_proai_annual` ($119.99/yr)
6. Configure Entitlements: `pro` and `proai`
7. Verify with RevenueCat Customer Override (no IAP bypass code in binary)

---

## 11. Rollback Plan

Per AGENTS.md §20, a rollback plan is required before any production deployment.

**Rollback trigger:** App Store / Play Store rejection, critical post-submission bug found.

**iOS rollback:** App Store rejections result in the previous version remaining live. No rollback action needed — the rejected build is simply not published. Fix the rejection reason on a new build number (autoIncrement handles this).

**Android rollback:** Internal track only for initial submission. No users on internal track means rollback = don't promote to production. Fix issue, re-upload.

**Code rollback:** Tag `develop` at the pre-EPIC-0011 commit as `v0.1.3-pre-ga` before any work begins, so the state can be restored if needed.

```bash
git tag -a v0.1.3-pre-ga -m "Pre-EPIC-0011 state — 1224 tests green"
git push origin v0.1.3-pre-ga
```

---

## 12. Test Strategy

EPIC-0011 has two categories of testing:

### Unit tests (≥80% coverage, standard DOD)

New files requiring test coverage:
- `src/ai/providers/openRouterProvider.ts` — mock fetch, verify cost calculation, verify free model detection, verify SSE parsing
- `src/ai/openRouterModelsService.ts` — mock fetch + AsyncStorage, verify cache TTL, verify offline fallback
- `src/ai/providers/byokProvider.ts` — verify all 5 preset URL/header configurations, verify costCents = 0 for all
- `src/components/ModelSearchSelector.tsx` — filter logic, FREE badge display, selection callback
- Updated `src/stores/useAIStore.ts` — byok fields, model pricing map hydration
- Updated `src/components/AIChatPanel.tsx` — built-in vs BYOK routing
- Updated `src/components/SettingsScreen.tsx` — BYOK section visibility per tier, PaywallAISheet reason prop

Deleted files (tests to remove): `claudeProvider.test.ts`, `geminiProvider.test.ts`, `kimiProvider.test.ts`, `customProvider.test.ts`

### Manual smoke tests (pre-submission checklist)

- [ ] `eas build --platform android --profile production` completes without error
- [ ] Android `.aab` installs on Pixel_Tablet_API35 emulator
- [ ] Built-in AI (OpenRouter key) returns completions on Pro+AI
- [ ] Free model shows "Unlimited" quota bar
- [ ] Paid model deducts from daily quota
- [ ] BYOK with Anthropic preset returns completions
- [ ] BYOK with custom endpoint (Ollama) returns completions
- [ ] Free tier user sees PaywallAISheet for both built-in and BYOK entry points
- [ ] Pro tier user can configure BYOK but cannot access built-in AI
- [ ] RevenueCat Customer Override correctly simulates all three tiers
- [ ] `eas submit --platform android` reaches Play Console internal track

iOS equivalents added once Apple enrollment clears.

---

## 13. Files to Create / Modify

### New files
| File | Purpose |
|---|---|
| `src/ai/providers/openRouterProvider.ts` | OpenRouter built-in provider |
| `src/ai/openRouterModelsService.ts` | Models list fetch + cache |
| `src/ai/providers/byokProvider.ts` | All BYOK presets (replaces customProvider) |
| `src/components/ModelSearchSelector.tsx` | Searchable model picker |
| `tests/unit/openRouterProvider.test.ts` | |
| `tests/unit/openRouterModelsService.test.ts` | |
| `tests/unit/byokProvider.test.ts` | |
| `tests/unit/ModelSearchSelector.test.tsx` | |

### Modified files
| File | Change |
|---|---|
| `eas.json` | Production env secrets, submit fields |
| `app.json` | Version 1.0.0, Privacy Manifests, versionCode |
| `package.json` | Version 1.0.0 |
| `src/ai/providerRegistry.ts` | Route to openRouterProvider / byokProvider |
| `src/ai/quotaConfig.ts` | Remove static price map, add DEFAULT_PRICE fallback |
| `src/stores/useAIStore.ts` | builtInModel, openRouterModels, modelPricingMap, byok fields |
| `src/components/AIChatPanel.tsx` | OpenRouter model selector, built-in vs BYOK routing |
| `src/components/SettingsScreen.tsx` | BYOK settings section, model search selector |
| `src/components/PaywallAISheet.tsx` | Add `reason` prop for two paywall messages |
| `src/components/FileExplorer.tsx` | Update tier check for BYOK (Pro+) |

### Deleted files
| File | Reason |
|---|---|
| `src/ai/providers/claudeProvider.ts` | Replaced by openRouterProvider |
| `src/ai/providers/geminiProvider.ts` | Replaced by openRouterProvider |
| `src/ai/providers/kimiProvider.ts` | Replaced by openRouterProvider |
| `src/ai/providers/customProvider.ts` | Replaced by byokProvider |
| `tests/unit/claudeProvider.test.ts` | Source deleted |
| `tests/unit/geminiProvider.test.ts` | Source deleted |
| `tests/unit/kimiProvider.test.ts` | Source deleted |
| `tests/unit/customProvider.test.ts` | Source deleted |

### Already created (this session)
| File | Purpose |
|---|---|
| `docs/privacy/index.html` | Privacy Policy (GitHub Pages) |
| `docs/support/index.html` | Support page (GitHub Pages) |
| `docs/.nojekyll` | Disables Jekyll |
| `docs/GITHUB_PAGES_SETUP.md` | Hosting instructions |

---

## 14. ID Registry — New Artefacts

The following IDs are assigned for acceptance criteria created during implementation planning. Registry must be updated before assigning.

| Artefact | ID Range | Notes |
|---|---|---|
| US-0036 ACs | AC-0308+ | EAS build pipeline |
| US-0037 ACs | AC-0308+ (sequential) | iOS submission |
| US-0038 ACs | AC-0308+ (sequential) | Android submission |

Current next available: **AC-0308** (per `docs/ID_REGISTRY.md`).

---

## 15. Open Questions / Decisions Made

| Question | Decision |
|---|---|
| Managed vs local signing? | EAS Managed (starting fresh, no existing certs) |
| OpenRouter vs separate providers? | OpenRouter replaces all three built-in providers |
| Restrict model list? | No — full catalog, user can search any model |
| Free model quota behaviour? | Free models = unlimited, no cap |
| BYOK tier gating? | Pro and above (Free tier sees PaywallAISheet) |
| Privacy policy hosting? | GitHub Pages from docs/ folder, updateable without resubmission |
| Support URL? | GitHub Issues via support page |
| iOS submission order vs Android? | Android first (not blocked); iOS follows after enrollment |
| Privacy Manifests required? | Yes — expo-secure-store triggers UserDefaults access |
