# TEST_CASES.md — NomadCode

Manual and automated test cases linked to User Stories and Acceptance Criteria.
All IDs are permanent — consult `Docs/ID_REGISTRY.md` before adding new entries.

---

## US-0021: Plan Status Dashboard

TC-0001: renderHtml returns valid HTML document
Related Story: US-0021
Related AC: AC-0001
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0002: renderHtml includes DOCTYPE declaration
Related Story: US-0021
Related AC: AC-0001
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0003: renderHtml includes Tailwind CDN link
Related Story: US-0021
Related AC: AC-0001
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0004: renderHtml includes Chart.js CDN link
Related Story: US-0021
Related AC: AC-0004
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0005: renderHtml includes project name in output
Related Story: US-0021
Related AC: AC-0001
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0006: renderHtml includes generated timestamp
Related Story: US-0021
Related AC: AC-0001
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0007: renderHtml includes commit SHA
Related Story: US-0021
Related AC: AC-0001
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0008: renderHtml includes total projected cost
Related Story: US-0021
Related AC: AC-0005
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0009: renderHtml includes coverage percent
Related Story: US-0021
Related AC: AC-0001
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0010: renderHtml includes epic filter option
Related Story: US-0021
Related AC: AC-0002
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0011: renderHtml includes all 6 navigation tabs
Related Story: US-0021
Related AC: AC-0001
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0012: renderHtml marks at-risk story with warning badge
Related Story: US-0021
Related AC: AC-0003
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0013: renderHtml renders bug rows in bugs tab when bugs present
Related Story: US-0021
Related AC: AC-0006
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0014: renderHtml renders traceability matrix when test cases present
Related Story: US-0021
Related AC: AC-0006
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0015: renderHtml omits Recent Activity widget when activity list is empty
Related Story: US-0021
Related AC: AC-0001
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0016: renderHtml shows 0% complete when no stories
Related Story: US-0021
Related AC: AC-0001
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0017: renderHtml does not render at-risk badge for safe story
Related Story: US-0021
Related AC: AC-0003
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0018: renderHtml renders AC items with linked TC reference
Related Story: US-0021
Related AC: AC-0003
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0019: renderHtml renders AC items without linked TC
Related Story: US-0021
Related AC: AC-0003
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0020: renderHtml renders red coverage indicator when below 80%
Related Story: US-0021
Related AC: AC-0001
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0021: renderHtml uses grey badge for unknown story status
Related Story: US-0021
Related AC: AC-0001
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0022: renderHtml shows no stories message for empty epic
Related Story: US-0021
Related AC: AC-0003
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0023: renderHtml places done story in Done kanban column (shows 100%)
Related Story: US-0021
Related AC: AC-0003
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0024: renderHtml renders Fail cell in traceability matrix
Related Story: US-0021
Related AC: AC-0006
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0025: renderHtml renders all risk reason labels in title attribute
Related Story: US-0021
Related AC: AC-0003
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0026: renderHtml renders Blocked story in kanban board
Related Story: US-0021
Related AC: AC-0003
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0027: renderHtml shows question mark for missing story estimate
Related Story: US-0021
Related AC: AC-0005
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0028: renderHtml renders Not Run cell in traceability matrix
Related Story: US-0021
Related AC: AC-0006
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0029: parseReleasePlan parses epics and stories from RELEASE_PLAN.md
Related Story: US-0021
Related AC: AC-0001
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0030: parseCostLog extracts rows from AI_COST_LOG.md markdown table
Related Story: US-0021
Related AC: AC-0008
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0031: aggregateCostByBranch sums tokens and cost per branch
Related Story: US-0021
Related AC: AC-0008
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0032: parseCoverage extracts lines, branches, functions, statements percentages
Related Story: US-0021
Related AC: AC-0004
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0033: detectAtRisk flags stories missing test cases, no branch, or failed TC
Related Story: US-0021
Related AC: AC-0003
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0034: parseTestCases parses TC entries with status from TEST_CASES.md
Related Story: US-0021
Related AC: AC-0006
Type: Unit
Status: [x] Pass
Defect Raised: None
