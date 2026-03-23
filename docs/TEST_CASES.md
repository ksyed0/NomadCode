# TEST_CASES.md — NomadCode

Manual and automated test cases linked to User Stories and Acceptance Criteria.
All IDs are permanent — consult `docs/ID_REGISTRY.md` before adding new entries.

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

## US-0007: Browse Directory Tree

TC-0035: long-press on a file opens the context menu
Related Story: US-0007
Related AC: AC-0035
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0037: context menu shows New File, New Folder, Rename, Move to, Delete options
Related Story: US-0007
Related AC: AC-0035
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0114: FileExplorer renders files from FileSystemBridge listing
Related Story: US-0007
Related AC: AC-0033
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0115: FileExplorer renders empty list without crashing
Related Story: US-0007
Related AC: AC-0033
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0116: tapping a directory node reveals its child entries
Related Story: US-0007
Related AC: AC-0034
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0117: expanded directory icon changes from right-arrow to down-arrow
Related Story: US-0007
Related AC: AC-0034
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0118: tapping an expanded directory collapses it and hides children
Related Story: US-0007
Related AC: AC-0034
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0119: long-press on a directory also opens the context menu
Related Story: US-0007
Related AC: AC-0035
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0120: tapping the context menu backdrop dismisses it
Related Story: US-0007
Related AC: AC-0035
Type: Unit
Status: [x] Pass
Defect Raised: None

## US-0008: Create Files and Folders

TC-0041: tapping New File opens the name input modal
Related Story: US-0008
Related AC: AC-0015
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0044: confirm calls createFile with path in the parent directory
Related Story: US-0008
Related AC: AC-0015
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0046: tree refreshes after file creation
Related Story: US-0008
Related AC: AC-0015
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0078: no-crash without callbacks (create file)
Related Story: US-0008
Related AC: AC-0015
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0049: tapping New Folder opens the name input modal
Related Story: US-0008
Related AC: AC-0016
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0050: confirm calls createDirectory with path in the parent directory
Related Story: US-0008
Related AC: AC-0016
Type: Unit
Status: [x] Pass
Defect Raised: None

## US-0009: Rename Files and Folders

TC-0053: Rename opens name modal pre-filled with current node name
Related Story: US-0009
Related AC: AC-0017
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0054: confirm calls moveEntry with old and new paths
Related Story: US-0009
Related AC: AC-0017
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0056: tree refreshes after rename
Related Story: US-0009
Related AC: AC-0017
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0079: no-crash without callbacks (rename)
Related Story: US-0009
Related AC: AC-0017
Type: Unit
Status: [x] Pass
Defect Raised: None

## US-0010: Delete Files and Folders

TC-0059: tapping Delete shows a confirmation Alert
Related Story: US-0010
Related AC: AC-0018
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0061: confirming Delete calls deleteEntry with the file path
Related Story: US-0010
Related AC: AC-0018
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0063: tree refreshes after confirmed delete
Related Story: US-0010
Related AC: AC-0018
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0060: Cancel in delete Alert does not call deleteEntry
Related Story: US-0010
Related AC: AC-0019
Type: Unit
Status: [x] Pass
Defect Raised: None

## US-0011: Move Files and Folders

TC-0066: tapping Move to opens the move picker modal
Related Story: US-0011
Related AC: AC-0020
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0070: confirming a valid move calls moveEntry, fires onFileMove, and refreshes
Related Story: US-0011
Related AC: AC-0020
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0077: full tree reload occurs after a successful move
Related Story: US-0011
Related AC: AC-0020
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0073: moving a directory to itself is blocked with an error alert
Related Story: US-0011
Related AC: AC-0021
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0074: moving a directory into its own descendant is blocked
Related Story: US-0011
Related AC: AC-0021
Type: Unit
Status: [x] Pass
Defect Raised: None

## US-0001: Open a File

TC-0081: FileExplorer renders all file entries returned by FileSystemBridge
Related Story: US-0001
Related AC: AC-0009
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0082: FileExplorer renders directory entries with expand icon
Related Story: US-0001
Related AC: AC-0009
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0083: FileExplorer renders EXPLORER header label
Related Story: US-0001
Related AC: AC-0009
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0084: tapping a file calls onFileSelect with the file path
Related Story: US-0001
Related AC: AC-0010
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0085: tapping a directory does not call onFileSelect
Related Story: US-0001
Related AC: AC-0010
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0086: editor-path-breadcrumb testID is present when a tab is active
Related Story: US-0001
Related AC: AC-0011
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0087: path bar shows the active tab file path
Related Story: US-0001
Related AC: AC-0011
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0088: path bar is absent in the empty-state (no open files)
Related Story: US-0001
Related AC: AC-0011
Type: Unit
Status: [x] Pass
Defect Raised: None

## US-0002: Syntax Highlighting

TC-0089: getLanguageForFile returns typescript for .tsx files
Related Story: US-0002
Related AC: AC-0012
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0090: getLanguageForFile returns python for .py files
Related Story: US-0002
Related AC: AC-0012
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0091: getLanguageForFile is case-insensitive for extensions
Related Story: US-0002
Related AC: AC-0012
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0092: pressing A+ toolbar button increments font size display
Related Story: US-0002
Related AC: AC-0013
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0093: pressing A- toolbar button decrements font size display
Related Story: US-0002
Related AC: AC-0013
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0094: editor wraps content in KeyboardAvoidingView with correct behavior prop
Related Story: US-0002
Related AC: AC-0014
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0095: KeyboardAvoidingView is present even in the empty state
Related Story: US-0002
Related AC: AC-0014
Type: Unit
Status: [x] Pass
Defect Raised: None

## US-0003: Save Changes

TC-0096: pressing Save toolbar action does not throw when editor is ready
Related Story: US-0003
Related AC: AC-0022
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0097: editor fires onSave message when Monaco sends a save event
Related Story: US-0003
Related AC: AC-0022
Type: Functional
Status: [x] Pass
Defect Raised: None

TC-0098: tab shows bullet dirty indicator when isDirty is true
Related Story: US-0003
Related AC: AC-0023
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0099: clean tab has no bullet prefix in the tab label
Related Story: US-0003
Related AC: AC-0023
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0100: Undo toolbar action fires without error when editor is ready
Related Story: US-0003
Related AC: AC-0024
Type: Unit
Status: [x] Pass
Defect Raised: None

## US-0004: Undo and Redo

TC-0101: pressing Undo toolbar button does not throw
Related Story: US-0004
Related AC: AC-0025
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0102: Undo button has correct aria-label for accessibility
Related Story: US-0004
Related AC: AC-0025
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0103: pressing Redo toolbar button does not throw
Related Story: US-0004
Related AC: AC-0026
Type: Unit
Status: [x] Pass
Defect Raised: None

## US-0005: Search and Replace

TC-0104: pressing Find toolbar button does not throw when editor is ready
Related Story: US-0005
Related AC: AC-0027
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0105: Find toolbar button is reachable via getByLabelText
Related Story: US-0005
Related AC: AC-0028
Type: Unit
Status: [x] Pass
Defect Raised: None

## US-0006: Multi-tab View

TC-0106: tab bar renders a label for each open tab
Related Story: US-0006
Related AC: AC-0029
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0107: tab bar renders a close button for each tab
Related Story: US-0006
Related AC: AC-0029
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0108: no files open shows "No files open" message instead of tab bar
Related Story: US-0006
Related AC: AC-0029
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0109: pressing a tab calls onTabChange with the tab path
Related Story: US-0006
Related AC: AC-0030
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0110: pressing the close button calls onTabClose with the correct path
Related Story: US-0006
Related AC: AC-0031
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0111: pressing the second tab close button calls onTabClose with the second tab path
Related Story: US-0006
Related AC: AC-0031
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0112: dirty tab label includes the bullet character prefix
Related Story: US-0006
Related AC: AC-0032
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0113: clean tab label does not include a bullet character
Related Story: US-0006
Related AC: AC-0032
Type: Unit
Status: [x] Pass
Defect Raised: None

## US-0012: Integrated Terminal

TC-0121: Terminal renders the TERMINAL header label on mount
Related Story: US-0012
Related AC: AC-0036
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0122: Terminal renders the $ prompt character on mount
Related Story: US-0012
Related AC: AC-0036
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0123: Terminal welcome output includes the workingDirectory value
Related Story: US-0012
Related AC: AC-0037
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0124: Terminal welcome output includes "NomadCode Terminal" banner
Related Story: US-0012
Related AC: AC-0037
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0125: submitting a command clears the text input to empty string
Related Story: US-0012
Related AC: AC-0038
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0126: Terminal wraps content in a KeyboardAvoidingView
Related Story: US-0012
Related AC: AC-0039
Type: Unit
Status: [x] Pass
Defect Raised: None

## US-0013: Run Commands

TC-0127: submitted command appears in output prefixed with $
Related Story: US-0013
Related AC: AC-0040
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0128: "help" command outputs available commands list
Related Story: US-0013
Related AC: AC-0040
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0129: onCommand callback is called with the submitted command string
Related Story: US-0013
Related AC: AC-0041
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0130: submitting empty input does not add an output line
Related Story: US-0013
Related AC: AC-0042
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0131: submitting empty input does not call onCommand
Related Story: US-0013
Related AC: AC-0042
Type: Unit
Status: [x] Pass
Defect Raised: None

## US-0014: Colored Terminal Output

TC-0132: command echo line renders with commandLine style (green)
Related Story: US-0014
Related AC: AC-0043
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0133: unknown command output uses error line style (Coral red)
Related Story: US-0014
Related AC: AC-0044
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0134: "echo" command output renders as a plain output line
Related Story: US-0014
Related AC: AC-0045
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0135: pwd output renders as a plain output line
Related Story: US-0014
Related AC: AC-0045
Type: Unit
Status: [x] Pass
Defect Raised: None

## US-0015: Open Command Palette

TC-0136: CommandPalette renders a search input placeholder
Related Story: US-0015
Related AC: AC-0046
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0137: CommandPalette renders all commands with empty query
Related Story: US-0015
Related AC: AC-0047
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0138: CommandPalette renders command descriptions when provided
Related Story: US-0015
Related AC: AC-0047
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0139: pressing the backdrop does not crash the component
Related Story: US-0015
Related AC: AC-0048
Type: Unit
Status: [ ] Not Run
Defect Raised: None

## US-0016: Search Commands

TC-0140: typing a query filters commands by label match
Related Story: US-0016
Related AC: AC-0049
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0141: typing a query filters commands by description match
Related Story: US-0016
Related AC: AC-0049
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0142: clearing the query restores all commands
Related Story: US-0016
Related AC: AC-0049
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0143: a query with no matches shows the empty state message
Related Story: US-0016
Related AC: AC-0050
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0144: pressing Enter calls onSelect with the first filtered command
Related Story: US-0016
Related AC: AC-0051
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0145: pressing Enter when no results does not call onSelect
Related Story: US-0016
Related AC: AC-0051
Type: Unit
Status: [ ] Not Run
Defect Raised: None

## US-0017: Keyboard Shortcuts in Palette

TC-0146: commands with a shortcut field show a badge with the shortcut text
Related Story: US-0017
Related AC: AC-0052
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0147: multiple shortcut badges are all rendered
Related Story: US-0017
Related AC: AC-0052
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0148: tapping a command without shortcut calls onSelect without error
Related Story: US-0017
Related AC: AC-0053
Type: Unit
Status: [ ] Not Run
Defect Raised: None

## US-0018: Light/Dark Themes

TC-0149: dark theme background token resolves to Deep Slate hex value
Related Story: US-0018
Related AC: AC-0054
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0150: light theme background token resolves to Off-White hex value
Related Story: US-0018
Related AC: AC-0055
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0151: design token contrast ratio for primary text on dark background is at least 4.5:1
Related Story: US-0018
Related AC: AC-0056
Type: Functional
Status: [ ] Not Run
Defect Raised: None

## US-0019: Change Font Size

TC-0152: pressing A+ increments the displayed font size by 1
Related Story: US-0019
Related AC: AC-0057
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0153: pressing A- decrements the displayed font size by 1
Related Story: US-0019
Related AC: AC-0058
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0154: default font size value is displayed between A- and A+ buttons
Related Story: US-0019
Related AC: AC-0059
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0155: font size display updates after pressing A+
Related Story: US-0019
Related AC: AC-0059
Type: Unit
Status: [ ] Not Run
Defect Raised: None

## US-0020: Install Extensions

TC-0156: ExtensionRegistry.register stores a manifest retrievable by id
Related Story: US-0020
Related AC: AC-0060
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0157: ExtensionRegistry.list returns all registered manifests
Related Story: US-0020
Related AC: AC-0060
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0158: activateExtension registers the manifest in ExtensionRegistry
Related Story: US-0020
Related AC: AC-0061
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0159: activateExtension returns HTML containing the extension source code
Related Story: US-0020
Related AC: AC-0061
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0160: deactivateExtension removes the extension from ExtensionRegistry
Related Story: US-0020
Related AC: AC-0062
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0161: buildSandboxHtml wraps extension source in a try/catch block
Related Story: US-0020
Related AC: AC-0063
Type: Unit
Status: [ ] Not Run
Defect Raised: None

TC-0162: buildSandboxHtml embeds the vscode API shim
Related Story: US-0020
Related AC: AC-0063
Type: Unit
Status: [ ] Not Run
Defect Raised: None
