# Risk Register

## Product: Mobile IDE

**Version:** 0.1
**Date:** 2026-03-09

---

## Risk Matrix

| ID | Risk | Likelihood | Impact | Score | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|---|
| R-001 | App Store rejection due to terminal/shell functionality | High | High | Critical | Engage Apple Dev Relations early; implement thorough sandbox; provide clear use-case documentation | PM | Open |
| R-002 | CodeMirror mobile performance insufficient | Medium | High | High | Prototype and benchmark early; have Monaco as fallback | Engineering | Open |
| R-003 | WASM extension sandbox security vulnerabilities | Medium | High | High | Third-party security audit; fuzzing; restricted API surface | Security | Open |
| R-004 | React Native performance on lower-end devices | Medium | Medium | Medium | Performance budget enforcement in CI; device lab testing | Engineering | Open |
| R-005 | Cloud sync data loss or conflicts | Low | High | High | Conflict-free CRDT-based sync; versioning; user-visible conflict resolution | Engineering | Open |
| R-006 | Key team member departure | Low | Medium | Medium | Knowledge sharing; documentation; cross-training | EM | Open |
| R-007 | Third-party dependency abandonment | Low | Medium | Medium | Prefer mature, widely-used libraries; maintain forks if necessary | Engineering | Open |
| R-008 | Scope creep delaying v1.0 | High | Medium | High | Strict feature freeze 4 weeks before launch; change control process | PM | Open |
| R-009 | Accessibility compliance failure | Medium | Medium | Medium | Integrate accessibility testing in CI from day one | QA | Open |
| R-010 | Google Play policy violation (terminal use) | Medium | High | High | Review Play policies; sandbox terminal; consult legal | PM/Legal | Open |

---

## Risk Scoring Key

| Likelihood | Score |
|---|---|
| High | 3 |
| Medium | 2 |
| Low | 1 |

| Impact | Score |
|---|---|
| High | 3 |
| Medium | 2 |
| Low | 1 |

**Score = Likelihood × Impact**
- 7–9: Critical
- 4–6: High
- 1–3: Medium/Low

---

## Review Cadence

Risk register reviewed bi-weekly by PM and Engineering Lead.
