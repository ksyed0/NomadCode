# Release Plan

## Product: Mobile IDE

**Version:** 0.1
**Date:** 2026-03-09

---

## Release Channels

| Channel | Audience | Cadence |
|---|---|---|
| Internal (dogfood) | Engineering & Design | Weekly |
| Alpha | Invited testers | Bi-weekly |
| Beta (TestFlight / Play Beta) | Public opt-in | Monthly |
| Production | All users | Quarterly major, monthly patch |

---

## v0.1 — Internal Alpha

**Target Date:** TBD
**Scope:**
- Core editor with syntax highlighting
- File system bridge (local only)
- Basic tablet layout

**Exit Criteria:**
- Zero P0 crashes in internal testing over 5 days
- Editor renders correctly on iPad and Android tablet

---

## v0.5 — Public Beta

**Target Date:** TBD
**Scope:**
- File Explorer
- Integrated terminal
- Command palette
- Settings / themes

**Exit Criteria:**
- Crash-free rate ≥ 99%
- p95 startup time < 2s on mid-range devices
- App Store beta review approved

---

## v1.0 — General Availability

**Target Date:** TBD
**Scope:**
- All Phase 1–4 features complete
- Extension sandbox (read-only API)
- Performance and accessibility standards met

**Exit Criteria:**
- App Store rating ≥ 4.5 (beta period)
- Crash-free rate ≥ 99.5%
- All P0 and P1 bugs resolved
- Legal, privacy, and compliance sign-off

---

## Rollout Strategy

1. **Staged rollout:** 5% → 25% → 50% → 100% over 2 weeks for each major release.
2. **Feature flags:** New features behind flags, enabled progressively.
3. **Rollback plan:** Hotfix release within 24h SLA for P0 issues post-launch.

---

## Communication Plan

- Release notes published to in-app changelog and marketing site.
- Email announcement to beta subscribers on GA.
- Social media announcements for major milestones.
