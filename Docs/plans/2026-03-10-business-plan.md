# NomadCode — Business Plan
**Date:** 2026-03-10
**Status:** Approved
**Scope:** Financial model + online marketing plan for iOS-first launch

---

## 1. Product Overview

**NomadCode** is a professional mobile IDE for iOS (iPad + iPhone), launching on the App Store.
Tagline: *Code from anywhere.*

**Core differentiator:** The only mobile IDE combining a Monaco-quality editor, integrated WASI terminal, Git, cloud sync, and AI assistance — fully offline-capable.

---

## 2. Competitive Landscape

| App | Model | Price | Rating | Ratings # | Key Gap |
|---|---|---|---|---|---|
| Textastic | Freemium | $2.99/mo · $19.99/yr · $69.99 one-time | 4.7★ | 2,403 | No AI, no real terminal |
| Koder | Free (IAP) | Free | 4.6★ | ~11,000 | Dated UI, no terminal, no Git push |
| Working Copy | Freemium | $35.99 one-time Pro | 4.9★ | 3,563 | Editor-only, Git-focused, no terminal |
| Replit | Freemium | $20/mo Pro | — | — | Cloud-dependent, not offline |

**Opportunity:** Koder's ~11,000 ratings (est. 500K–1M installs) proves strong demand.
No competitor offers the full stack: Monaco editor + terminal + AI + Git + offline.

---

## 3. Pricing Tiers (all prices USD)

| Tier | Monthly | Annual | Annual equivalent/mo |
|---|---|---|---|
| **Free** | $0 | $0 | $0 |
| **Pro** | $4.99 | $39.99 | $3.33 |
| **Pro+** | $19.99 | $199.00 | $16.58 |

### Feature Breakdown

| Feature | Free | Pro | Pro+ |
|---|---|---|---|
| Monaco editor (80+ languages) | ✓ | ✓ | ✓ |
| Syntax highlighting | ✓ | ✓ | ✓ |
| File explorer + CRUD | ✓ | ✓ | ✓ |
| Command palette | ✓ | ✓ | ✓ |
| Local file system | ✓ | ✓ | ✓ |
| Dark theme | ✓ | ✓ | ✓ |
| Integrated terminal (WASI) | — | ✓ | ✓ |
| Git (clone / commit / push / pull) | — | ✓ | ✓ |
| Cloud sync (iCloud) | — | ✓ | ✓ |
| Multiple themes + font customisation | — | ✓ | ✓ |
| Extensions marketplace | — | ✓ | ✓ |
| AI code completion (inline) | — | — | ✓ |
| AI explain / fix / refactor | — | — | ✓ |
| AI chat assistant | — | — | ✓ |

---

## 4. Financial Model

### 4.1 Key Assumptions

| Assumption | Value |
|---|---|
| App Store cut | 15% (Apple Small Business Program, <$1M/yr) |
| Free → Pro conversion | 4% of MAU |
| Pro → Pro+ upsell | 15% of Pro users |
| Monthly churn — Pro | 5% |
| Monthly churn — Pro+ | 3% |
| Annual / monthly plan mix | 60% annual, 40% monthly |
| Android launch | Start of Year 2 (+50% installs) |
| Launch date | Q3 2026 |

### 4.2 Blended ARPU (net of App Store 15%)

| Tier | Monthly plan net | Annual plan net/mo | Blended net/mo |
|---|---|---|---|
| Pro | $4.24 | $2.83 | **$3.40** |
| Pro+ | $16.99 | $14.10 | **$15.26** |
| Weighted (85% Pro / 15% Pro+) | | | **$5.18** |

### 4.3 Three-Year MRR / ARR Projections

#### Scenario A — Bootstrap ($0/mo marketing)

| Period | Monthly Installs | Pro Users | Pro+ Users | MRR | ARR |
|---|---|---|---|---|---|
| Y1 Launch (M1) | 200 | 5 | 1 | $20 | $240 |
| Y1 Mid (M6) | 800 | 100 | 15 | $570 | $6,840 |
| Y1 End (M12) | 1,500 | 250 | 40 | $1,460 | $17,520 |
| Y2 End (M24) | 3,000 | 800 | 150 | $5,010 | $60,120 |
| Y3 End (M36) | 5,000 | 2,000 | 400 | $12,900 | $154,800 |

**Y1 Total Revenue:** ~$8,000 USD
**Y3 Total Revenue:** ~$100,000 USD

---

#### Scenario B — Small (~$750/mo marketing)

| Period | Monthly Installs | Pro Users | Pro+ Users | MRR | ARR |
|---|---|---|---|---|---|
| Y1 Launch (M1) | 500 | 15 | 2 | $82 | $984 |
| Y1 Mid (M6) | 2,000 | 300 | 45 | $1,707 | $20,484 |
| Y1 End (M12) | 4,000 | 700 | 110 | $4,060 | $48,720 |
| Y2 End (M24) | 8,000 | 2,500 | 400 | $14,604 | $175,248 |
| Y3 End (M36) | 15,000 | 7,000 | 1,200 | $42,112 | $505,344 |

**Y1 Total Revenue:** ~$20,000 USD | **Y1 Marketing Spend:** ~$9,000 USD | **Y1 Net:** ~$11,000 USD
**Y3 Total Revenue:** ~$320,000 USD

---

#### Scenario C — Medium (~$3,500/mo marketing)

| Period | Monthly Installs | Pro Users | Pro+ Users | MRR | ARR |
|---|---|---|---|---|---|
| Y1 Launch (M1) | 1,500 | 45 | 7 | $260 | $3,120 |
| Y1 Mid (M6) | 6,000 | 1,000 | 160 | $5,844 | $70,128 |
| Y1 End (M12) | 12,000 | 2,500 | 400 | $14,604 | $175,248 |
| Y2 End (M24) | 25,000 | 10,000 | 1,800 | $61,468 | $737,616 |
| Y3 End (M36) | 50,000 | 25,000 | 5,000 | $161,300 | $1,935,600 |

**Y1 Total Revenue:** ~$70,000 USD | **Y1 Marketing Spend:** ~$42,000 USD | **Y1 Net:** ~$28,000 USD
**Y3 Total Revenue:** ~$1,200,000 USD

---

### 4.4 Unit Economics

| Metric | Bootstrap | Small | Medium |
|---|---|---|---|
| CAC (cash) | $0 | ~$30 | ~$23 |
| Blended LTV (Pro 85% / Pro+ 15%) | $107 | $107 | $107 |
| LTV : CAC | ∞ | **3.6×** | **4.6×** |
| CAC payback period | organic | ~6 months | ~4.5 months |

LTV calculation:
- Pro: 18-month avg lifetime × $3.40/mo = $61.20
- Pro+: 24-month avg lifetime × $15.26/mo = $366.24
- Blended (85/15): $107

---

## 5. Marketing Plan (Online Only)

### 5.1 Target Audience

| Segment | Description | Est. iOS Market Size |
|---|---|---|
| **Primary** | Professional developers who own an iPad and want desktop-class coding on the go | ~500K |
| **Secondary** | CS students / bootcamp learners coding on iPhone/iPad as primary device | ~2M |
| **Tertiary** | Digital nomads / remote workers travelling light, needing a full dev environment | ~150K |

---

### 5.2 Channel Strategy

#### All Tiers — Zero-Cost Channels

| Channel | Tactic | Est. Monthly Reach |
|---|---|---|
| **ASO** | Keyword-optimised title, subtitle, screenshots, 30-sec preview video | App Store search |
| **Product Hunt** | Launch day post — target #1 Product of the Day | 5K–50K visitors (one-time) |
| **Hacker News Show HN** | Post at v0.1 launch | 2K–20K visitors (one-time) |
| **Reddit (organic)** | r/iOSProgramming (200K), r/iPad (1.5M), r/programming (6M), r/webdev (1M) | 500–2,000 impressions/mo |
| **Twitter/X (organic)** | Build-in-public threads, demo videos, #iOSdev, #BuildInPublic | 500–3,000 impressions/mo |
| **Dev.to / Hashnode** | "I built a full IDE for iPad" longform articles | 1K–5K views/mo |
| **Email list** | Landing page pre-launch capture + in-app onboarding | Compounding |

#### Scenario B — Small (~$750/mo paid)

All zero-cost channels, plus:

| Channel | Budget | Tactic |
|---|---|---|
| **Apple Search Ads** | $400/mo | Keywords: "code editor", "iOS IDE", "coding app" — est. CPT $1.50, ~40 installs/day |
| **Reddit Ads** | $150/mo | r/iOSProgramming, r/learnprogramming — developer CPM targeting |
| **Twitter/X Ads** | $150/mo | Target followers of @github, @vercel, @expo — promote demo video |
| **Tools** | $50/mo | ConvertKit (email), Buffer (social scheduling) |

#### Scenario C — Medium (~$3,500/mo paid)

All above, plus:

| Channel | Budget | Tactic |
|---|---|---|
| **Apple Search Ads** | $1,500/mo | Expand keywords, competitor conquesting (Textastic, Koder) |
| **Reddit Ads** | $500/mo | Scale what works from Small tier |
| **Twitter/X Ads** | $500/mo | Retargeting website visitors |
| **YouTube Ads** | $500/mo | Pre-roll on developer tutorial videos |
| **Influencer / Affiliate** | $300/mo | iPad-focused tech YouTubers, 15% affiliate commission |
| **SEO / Content tools** | $200/mo | Ahrefs, ConvertKit Pro, Webflow |

---

### 5.3 Launch Sequence

| Milestone | Timing | Actions |
|---|---|---|
| Pre-launch setup | T-12 weeks | Landing page live, email capture, ASO keyword research |
| Content engine | T-8 weeks | Dev blog starts ("Building NomadCode" series), social accounts active |
| Beta | T-4 weeks | Beta invites to waitlist, Product Hunt upcoming page, hunter outreach |
| **Launch day** | **T-0** | **Product Hunt + HN Show HN + Reddit posts (same day, coordinated)** |
| Post-launch | T+2 weeks | Dev.to / Hashnode article, first email blast to waitlist |
| Paid acquisition | T+4 weeks | Start Apple Search Ads (Small/Medium tiers) |
| ASO optimisation | T+8 weeks | A/B test screenshots, update keywords from real search data |
| Channel review | T+12 weeks | Double down on top 2 channels, cut bottom performer |
| Android launch | T+6 months | Separate Product Hunt post, Google Play ASO |

---

### 5.4 Key Metrics to Track

| Metric | Y1 EOY Target |
|---|---|
| App Store impressions → install rate | ≥ 3% |
| Install → Free MAU (30-day retention) | ≥ 40% |
| MAU → Pro conversion | ≥ 4% |
| Pro → Pro+ upsell rate | ≥ 15% |
| Monthly churn — Pro | ≤ 5% |
| Monthly churn — Pro+ | ≤ 3% |
| Net Promoter Score (NPS) | ≥ 50 |

---

## 6. Recommended Path

Start **Bootstrap**, launch on Product Hunt + HN at v0.1, validate conversion metrics.
Upgrade to **Small** once installs exceed 1,000/mo and Pro conversion ≥ 3%.
Upgrade to **Medium** once LTV:CAC is confirmed ≥ 3× from real data.

The medium scenario reaches **$1.2M ARR by Year 3** — a viable indie SaaS business.

---

*Generated: 2026-03-10 | All figures USD | Market research: App Store (March 2026)*
