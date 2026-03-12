# EPIC-0004 Command Palette Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full audit-and-rebuild of the CommandPalette component — fix the `onRequestClose` bug, switch to `visible`/`onClose` API, add keyboard up/down navigation, add a swipe-down gesture trigger in `TabletResponsive`, and achieve explicit test coverage for all 8 acceptance criteria.

**Architecture:** `CommandPalette` adopts a standard RN Modal API (`visible` + `onClose`). The backdrop is absolutely positioned behind the panel (not wrapping it), so touches inside the panel never propagate to `onClose`. `TabletResponsive` gets an `onOpenPalette` prop and a thin `PanResponder` swipe zone at the top of the main editor area.

**Tech Stack:** React Native 0.76, TypeScript 5, `@testing-library/react-native`, Jest

---

## Context: What Already Exists

- `src/components/CommandPalette.tsx` — existing component, **will be fully rebuilt**
- `App.tsx` — mounts `CommandPalette` conditionally; **will be updated** to `visible`/`onClose`
- `src/layout/TabletResponsive.tsx` — already uses `PanResponder` for terminal resize; **adding second PanResponder** for swipe zone
- `tests/unit/CommandPalette.test.tsx` — existing 13 tests, **fully replaced** (22 new tests)
- `tests/unit/TabletResponsive.test.tsx` — existing tests, **adding** swipe zone describe block

---

## Bugs Being Fixed (see BUGS.md)

- **CP-1:** `onRequestClose` fires first command on Android back → fix: call `onClose()`
- **CP-2:** Backdrop does not close the palette → fix: call `onClose()` on backdrop press
- **CP-3/4:** AC-0046, AC-0048, AC-0053 untested; lines 79–83 uncovered → fix: full test rebuild

---

## Pre-flight

```bash
cd /Users/Kamal_Syed/Projects/NomadCode
git checkout develop && git pull
git checkout -b feature/epic-0004-command-palette
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false
# Expected: 282 tests pass
```

---

## Task 1: Rebuild CommandPalette tests (write first, all fail until Task 2)

**Files:**
- Replace: `mobile-ide/mobile-ide-prototype/tests/unit/CommandPalette.test.tsx`

### Step 1: Replace the test file with the full 22-test suite

```typescript
/**
 * Unit tests — CommandPalette component (EPIC-0004)
 *
 * Covers all 8 acceptance criteria (AC-0046 – AC-0053) explicitly,
 * plus keyboard navigation, dismiss behaviour, and edge cases.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CommandPalette, Command } from '../../src/components/CommandPalette';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeCommands = (): Command[] => [
  { id: 'file-save',     label: 'File: Save',           shortcut: '⌘S',  action: jest.fn() },
  { id: 'file-close',    label: 'File: Close Tab',                        action: jest.fn() },
  { id: 'view-terminal', label: 'View: Toggle Terminal', shortcut: '⌘`',  action: jest.fn(),
    description: 'Show or hide the terminal' },
  { id: 'git-status',    label: 'Git: Show Status',                       action: jest.fn() },
];

function renderPalette(
  overrides: Partial<{ onSelect: jest.Mock; onClose: jest.Mock; commands: Command[] }> = {},
) {
  const props = {
    visible: true,
    commands: makeCommands(),
    onSelect: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  render(<CommandPalette {...props} />);
  return props;
}

// ---------------------------------------------------------------------------
// AC-0046: auto-focus
// ---------------------------------------------------------------------------

describe('CommandPalette — AC-0046 auto-focus', () => {
  it('AC-0046: search TextInput has autoFocus set to true', () => {
    renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
    expect(input.props.autoFocus).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-0047: renders all commands when query is empty
// ---------------------------------------------------------------------------

describe('CommandPalette — AC-0047 initial render', () => {
  it('AC-0047: renders all commands when query is empty', () => {
    renderPalette();
    expect(screen.getByText('File: Save')).toBeTruthy();
    expect(screen.getByText('File: Close Tab')).toBeTruthy();
    expect(screen.getByText('View: Toggle Terminal')).toBeTruthy();
    expect(screen.getByText('Git: Show Status')).toBeTruthy();
  });

  it('renders descriptions when provided', () => {
    renderPalette();
    expect(screen.getByText('Show or hide the terminal')).toBeTruthy();
  });

  it('renders the search input with placeholder', () => {
    renderPalette();
    expect(screen.getByPlaceholderText(/Search commands/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC-0048: backdrop dismisses keyboard (calls onClose)
// ---------------------------------------------------------------------------

describe('CommandPalette — AC-0048 backdrop dismiss', () => {
  it('AC-0048: backdrop press calls onClose', () => {
    const { onClose, onSelect } = renderPalette();
    fireEvent.press(screen.getByTestId('palette-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop press does not call onSelect', () => {
    const { onSelect } = renderPalette();
    fireEvent.press(screen.getByTestId('palette-backdrop'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('onRequestClose calls onClose, not onSelect (Android back button fix)', () => {
    // The Modal's onRequestClose prop must be onClose, not a selection action.
    // We verify by checking that onClose is wired; the actual prop is tested
    // by confirming onSelect is NOT called on component unmount/back.
    const { onClose, onSelect } = renderPalette();
    // Fire the Modal's onRequestClose via testID on the Modal (RNTL wraps modals)
    // Simulated by checking the component renders with onRequestClose={onClose}
    const modal = screen.UNSAFE_getByType(require('react-native').Modal);
    expect(modal.props.onRequestClose).toBe(onClose);
    expect(modal.props.onRequestClose).not.toBe(onSelect);
  });
});

// ---------------------------------------------------------------------------
// AC-0049, AC-0050: filtering
// ---------------------------------------------------------------------------

describe('CommandPalette — AC-0049/0050 filtering', () => {
  it('AC-0049: filters commands by label (case-insensitive)', () => {
    renderPalette();
    fireEvent.changeText(screen.getByPlaceholderText(/Search commands/i), 'git');
    expect(screen.getByText('Git: Show Status')).toBeTruthy();
    expect(screen.queryByText('File: Save')).toBeNull();
    expect(screen.queryByText('View: Toggle Terminal')).toBeNull();
  });

  it('AC-0049: filters commands by description', () => {
    renderPalette();
    fireEvent.changeText(screen.getByPlaceholderText(/Search commands/i), 'hide the terminal');
    expect(screen.getByText('View: Toggle Terminal')).toBeTruthy();
    expect(screen.queryByText('File: Save')).toBeNull();
  });

  it('AC-0049: matches partial substrings', () => {
    renderPalette();
    fireEvent.changeText(screen.getByPlaceholderText(/Search commands/i), 'sav');
    expect(screen.getByText('File: Save')).toBeTruthy();
    expect(screen.queryByText('Git: Show Status')).toBeNull();
  });

  it('AC-0049: shows all commands when query is cleared', () => {
    renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
    fireEvent.changeText(input, 'git');
    fireEvent.changeText(input, '');
    expect(screen.getByText('File: Save')).toBeTruthy();
    expect(screen.getByText('Git: Show Status')).toBeTruthy();
  });

  it('AC-0050: shows "No commands found" when nothing matches', () => {
    renderPalette();
    fireEvent.changeText(screen.getByPlaceholderText(/Search commands/i), 'xyzzy');
    expect(screen.getByText(/No commands found/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC-0051: Enter selects first filtered result
// ---------------------------------------------------------------------------

describe('CommandPalette — AC-0051 Enter to select', () => {
  it('AC-0051: Enter selects the first result in the filtered list', () => {
    const { onSelect } = renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
    fireEvent.changeText(input, 'git');
    fireEvent(input, 'submitEditing');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'git-status' }));
  });

  it('AC-0051: does not call onSelect on Enter when no commands match', () => {
    const { onSelect } = renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
    fireEvent.changeText(input, 'xyzzy');
    fireEvent(input, 'submitEditing');
    expect(onSelect).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC-0052: shortcut badge
// ---------------------------------------------------------------------------

describe('CommandPalette — AC-0052 shortcut badges', () => {
  it('AC-0052: renders shortcut badge for commands that have a shortcut', () => {
    renderPalette();
    expect(screen.getByText('⌘S')).toBeTruthy();
    expect(screen.getByText('⌘`')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC-0053: no empty badge
// ---------------------------------------------------------------------------

describe('CommandPalette — AC-0053 no empty badge', () => {
  it('AC-0053: commands without shortcut render no badge', () => {
    renderPalette();
    // "File: Close Tab" and "Git: Show Status" have no shortcut.
    // Verify there is no empty shortcut badge text next to these items.
    // The shortcut badge is only rendered when item.shortcut is truthy,
    // so we check that only the known shortcuts appear in the tree.
    const allShortcutTexts = screen
      .queryAllByText(/^[⌘⌃⌥⇧].+/)
      .map((el) => el.props.children);
    expect(allShortcutTexts).toEqual(expect.arrayContaining(['⌘S', '⌘`']));
    expect(allShortcutTexts).toHaveLength(2); // exactly 2 — no empty badges
  });
});

// ---------------------------------------------------------------------------
// Keyboard navigation (enhancement, power user persona)
// ---------------------------------------------------------------------------

describe('CommandPalette — keyboard navigation', () => {
  it('ArrowDown advances selection: Enter submits second item', () => {
    const { onSelect } = renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'ArrowDown' } });
    fireEvent(input, 'submitEditing');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-close' }));
  });

  it('ArrowUp after two ArrowDowns returns to first item', () => {
    const { onSelect } = renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'ArrowDown' } });
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'ArrowDown' } });
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'ArrowUp' } });
    fireEvent(input, 'submitEditing');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-close' }));
  });

  it('ArrowUp on first item stays at index 0', () => {
    const { onSelect } = renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'ArrowUp' } });
    fireEvent(input, 'submitEditing');
    // Still selects first item (file-save), not undefined
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-save' }));
  });

  it('query change resets selectedIndex to 0', () => {
    const { onSelect } = renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'ArrowDown' } });
    // Change query — selectedIndex must reset
    fireEvent.changeText(input, 'git');
    fireEvent(input, 'submitEditing');
    // After reset, Enter picks filtered[0] which is 'git-status'
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'git-status' }));
  });

  it('item at selectedIndex renders with Nomad Blue highlight style', () => {
    renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
    // ArrowDown → index 1 = 'File: Close Tab'
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'ArrowDown' } });
    const selectedItem = screen.getByTestId('item-1');
    expect(selectedItem.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: '#2563EB' }),
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// onSelect vs onClose separation
// ---------------------------------------------------------------------------

describe('CommandPalette — onSelect vs onClose', () => {
  it('tapping a command calls onSelect but NOT onClose', () => {
    const { onSelect, onClose } = renderPalette();
    fireEvent.press(screen.getByText('File: Save'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-save' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('CommandPalette — edge cases', () => {
  it('renders with empty command list without crashing', () => {
    renderPalette({ commands: [] });
    expect(screen.getByText(/No commands found/i)).toBeTruthy();
  });

  it('does not render content when visible is false', () => {
    render(
      <CommandPalette
        visible={false}
        commands={makeCommands()}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByPlaceholderText(/Search commands/i)).toBeNull();
  });
});
```

### Step 2: Run tests to verify they fail

```bash
cd mobile-ide/mobile-ide-prototype
npx jest --watchAll=false --testPathPattern="CommandPalette" --verbose 2>&1 | tail -30
```

Expected: Most tests **FAIL** — `onClose` prop doesn't exist yet.

### Step 3: Commit the test file

```bash
git add tests/unit/CommandPalette.test.tsx
git commit -m "test(EPIC-0004): write CommandPalette test suite — all 8 ACs + nav + edge cases"
```

---

## Task 2: Rebuild CommandPalette.tsx

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/CommandPalette.tsx`

### Step 1: Replace the component implementation

```typescript
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Keyboard,
} from 'react-native';

export interface Command {
  id: string;
  label: string;
  description?: string;
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  /** Whether the palette is visible */
  visible: boolean;
  commands: Command[];
  /** Dismiss without selecting (back button, backdrop tap) */
  onClose: () => void;
  /** Select a command — parent is responsible for also calling onClose */
  onSelect: (command: Command) => void;
  placeholder?: string;
}

export function CommandPalette({
  visible,
  commands,
  onClose,
  onSelect,
  placeholder = 'Search commands…',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q),
    );
  }, [query, commands]);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    setSelectedIndex(0);
  }, []);

  const handleSelect = useCallback(
    (cmd: Command) => {
      Keyboard.dismiss();
      onSelect(cmd);
    },
    [onSelect],
  );

  const handleSubmit = useCallback(() => {
    if (filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    }
  }, [filtered, selectedIndex, handleSelect]);

  const handleKeyPress = useCallback(
    (e: { nativeEvent: { key: string } }) => {
      const { key } = e.nativeEvent;
      if (key === 'ArrowDown') {
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (key === 'ArrowUp') {
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
    },
    [filtered.length],
  );

  const handleBackdropPress = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const renderItem = ({ item, index }: { item: Command; index: number }) => {
    const isSelected = index === selectedIndex;
    return (
      <TouchableOpacity
        testID={`item-${index}`}
        style={[
          styles.item,
          index === 0 && styles.itemFirst,
          isSelected && styles.itemSelected,
        ]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itemContent}>
          <Text style={[styles.itemLabel, isSelected && styles.itemLabelSelected]}>
            {item.label}
          </Text>
          {item.description && (
            <Text style={styles.itemDescription} numberOfLines={1}>
              {item.description}
            </Text>
          )}
        </View>
        {item.shortcut && (
          <View style={styles.shortcutBadge}>
            <Text style={styles.shortcutText}>{item.shortcut}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Backdrop — absolutely positioned behind the panel */}
        <TouchableOpacity
          testID="palette-backdrop"
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleBackdropPress}
        />
        {/* Panel — rendered on top of backdrop; touches here do not bubble */}
        <View style={styles.panel}>
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>⌘</Text>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={handleQueryChange}
              placeholder={placeholder}
              placeholderTextColor="#475569"
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              onKeyPress={handleKeyPress}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="always"
            style={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>No commands found</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00000088',
    alignItems: 'center',
    paddingTop: 80,
  },
  panel: {
    width: '90%',
    maxWidth: 600,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: 400,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  searchIcon: {
    color: '#475569',
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 15,
  },
  list: {
    flexGrow: 0,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#0F172A',
  },
  itemFirst: {
    borderTopWidth: 0,
  },
  itemSelected: {
    backgroundColor: '#2563EB',
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    color: '#E2E8F0',
    fontSize: 14,
  },
  itemLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  itemDescription: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  shortcutBadge: {
    backgroundColor: '#0F172A',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  shortcutText: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  empty: {
    color: '#475569',
    textAlign: 'center',
    padding: 20,
    fontSize: 14,
  },
});
```

### Step 2: Run CommandPalette tests

```bash
npx jest --watchAll=false --testPathPattern="CommandPalette" --verbose 2>&1 | tail -30
```

Expected: **All 22 tests pass.**

### Step 3: Run full test suite

```bash
npx jest --watchAll=false 2>&1 | tail -10
```

Expected: Some App.tsx-related tests may fail (it passes `onSelect` without `visible`). That's OK — fixed in Task 4.

### Step 4: Commit

```bash
git add src/components/CommandPalette.tsx
git commit -m "feat(EPIC-0004): rebuild CommandPalette — visible/onClose API, keyboard nav, fix back button bug"
```

---

## Task 3: Add swipe gesture tests to TabletResponsive

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/TabletResponsive.test.tsx`

### Step 1: Append swipe zone test block to the file

Add after the last `describe` block (after `clampTerminalHeight`):

```typescript
// ---------------------------------------------------------------------------
// isDownwardSwipe utility (exported from TabletResponsive)
// ---------------------------------------------------------------------------

import { isDownwardSwipe } from '../../src/layout/TabletResponsive';

describe('isDownwardSwipe', () => {
  it('returns true when dy > 40 and vy > 0.3', () => {
    expect(isDownwardSwipe(50, 0.4)).toBe(true);
  });

  it('returns false when dy is exactly 40 (not strictly greater)', () => {
    expect(isDownwardSwipe(40, 0.4)).toBe(false);
  });

  it('returns false when vy is exactly 0.3 (not strictly greater)', () => {
    expect(isDownwardSwipe(50, 0.3)).toBe(false);
  });

  it('returns false when dy is below threshold', () => {
    expect(isDownwardSwipe(30, 0.4)).toBe(false);
  });

  it('returns false when vy is below threshold', () => {
    expect(isDownwardSwipe(50, 0.2)).toBe(false);
  });

  it('returns true at minimum passing values (dy=41, vy=0.31)', () => {
    expect(isDownwardSwipe(41, 0.31)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Swipe gesture zone
// ---------------------------------------------------------------------------

describe('TabletResponsive — swipe gesture zone', () => {
  beforeEach(() => setWidth(1024));

  it('renders swipe-zone testID in main area', () => {
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />,
    );
    expect(screen.getByTestId('swipe-zone')).toBeTruthy();
  });

  it('renders swipe-zone on phone layout too', () => {
    setWidth(375);
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />,
    );
    expect(screen.getByTestId('swipe-zone')).toBeTruthy();
  });

  it('calls onOpenPalette when swipe-down gesture is released', () => {
    let capturedSwipeCbs: Record<string, (...args: unknown[]) => unknown> = {};
    let callIdx = 0;
    const spy = jest.spyOn(PanResponder, 'create').mockImplementation((cbs) => {
      // First call = terminal resize; second call = swipe zone
      if (callIdx++ === 1) {
        capturedSwipeCbs = cbs as unknown as Record<string, (...args: unknown[]) => unknown>;
      }
      return { panHandlers: {} } as ReturnType<typeof PanResponder.create>;
    });

    const onOpenPalette = jest.fn();
    render(
      <TabletResponsive
        sidebar={<Sidebar />}
        main={<Main />}
        terminal={<Terminal />}
        onOpenPalette={onOpenPalette}
      />,
    );

    expect(capturedSwipeCbs.onStartShouldSetPanResponder?.()).toBe(true);
    capturedSwipeCbs.onPanResponderRelease?.({}, { dy: 50, vy: 0.4 });
    expect(onOpenPalette).toHaveBeenCalledTimes(1);

    spy.mockRestore();
    callIdx = 0;
  });

  it('does not call onOpenPalette for swipes below threshold', () => {
    let capturedSwipeCbs: Record<string, (...args: unknown[]) => unknown> = {};
    let callIdx = 0;
    const spy = jest.spyOn(PanResponder, 'create').mockImplementation((cbs) => {
      if (callIdx++ === 1) {
        capturedSwipeCbs = cbs as unknown as Record<string, (...args: unknown[]) => unknown>;
      }
      return { panHandlers: {} } as ReturnType<typeof PanResponder.create>;
    });

    const onOpenPalette = jest.fn();
    render(
      <TabletResponsive
        sidebar={<Sidebar />}
        main={<Main />}
        terminal={<Terminal />}
        onOpenPalette={onOpenPalette}
      />,
    );

    capturedSwipeCbs.onPanResponderRelease?.({}, { dy: 30, vy: 0.4 }); // dy too small
    capturedSwipeCbs.onPanResponderRelease?.({}, { dy: 50, vy: 0.2 }); // vy too small
    expect(onOpenPalette).not.toHaveBeenCalled();

    spy.mockRestore();
    callIdx = 0;
  });

  it('does not crash when onOpenPalette is not provided', () => {
    let capturedSwipeCbs: Record<string, (...args: unknown[]) => unknown> = {};
    let callIdx = 0;
    const spy = jest.spyOn(PanResponder, 'create').mockImplementation((cbs) => {
      if (callIdx++ === 1) capturedSwipeCbs = cbs as unknown as Record<string, (...args: unknown[]) => unknown>;
      return { panHandlers: {} } as ReturnType<typeof PanResponder.create>;
    });

    render(<TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />);
    expect(() =>
      capturedSwipeCbs.onPanResponderRelease?.({}, { dy: 50, vy: 0.4 }),
    ).not.toThrow();

    spy.mockRestore();
    callIdx = 0;
  });
});
```

**Note on `callIdx`:** `PanResponder.create` is called twice — once for the terminal resize handle (existing), once for the swipe zone (new). The spy captures the **second** call (index 1) as the swipe zone callbacks.

### Step 2: Run TabletResponsive tests to verify new ones fail

```bash
npx jest --watchAll=false --testPathPattern="TabletResponsive" --verbose 2>&1 | tail -20
```

Expected: `isDownwardSwipe` and swipe zone tests **FAIL** (not exported/implemented yet).

### Step 3: Commit

```bash
git add tests/unit/TabletResponsive.test.tsx
git commit -m "test(EPIC-0004): add swipe zone and isDownwardSwipe tests to TabletResponsive"
```

---

## Task 4: Add swipe zone to TabletResponsive.tsx

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/layout/TabletResponsive.tsx`

### Step 1: Apply these changes

**a) Add `isDownwardSwipe` export after `clampTerminalHeight`:**

```typescript
/** Exported for unit-testing the swipe-to-open predicate. */
export function isDownwardSwipe(dy: number, vy: number): boolean {
  return dy > 40 && vy > 0.3;
}
```

**b) Add `onOpenPalette` to the props interface (after `onTerminalHeightChange`):**

```typescript
  /** Called when user swipes down on the main editor area to open command palette */
  onOpenPalette?: () => void;
```

**c) Destructure `onOpenPalette` in the function signature:**

```typescript
export default function TabletResponsive({
  sidebar,
  main,
  terminal,
  sidebarWidth = SIDEBAR_WIDTH,
  terminalHeight = TERMINAL_HEIGHT,
  onTerminalHeightChange,
  onOpenPalette,
}: TabletResponsiveProps) {
```

**d) Add swipe `PanResponder` after the existing `panResponder` ref:**

```typescript
  const swipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, gs) => {
        if (isDownwardSwipe(gs.dy, gs.vy)) {
          onOpenPalette?.();
        }
      },
    }),
  ).current;
```

**e) Add swipe zone View at the top of `mainArea` in tablet layout (replace `<View style={styles.mainArea}>{main}</View>`):**

```tsx
<View style={styles.mainArea}>
  <View
    testID="swipe-zone"
    style={styles.swipeZone}
    {...swipePanResponder.panHandlers}
  />
  {main}
</View>
```

**f) Same change for phone layout (replace `<View style={styles.phoneMainArea}>{main}</View>`):**

```tsx
<View style={styles.phoneMainArea}>
  <View
    testID="swipe-zone"
    style={styles.swipeZone}
    {...swipePanResponder.panHandlers}
  />
  {main}
</View>
```

**g) Add `swipeZone` to the StyleSheet (after `mainArea`):**

```typescript
  swipeZone: {
    height: 8,
    width: '100%',
    backgroundColor: 'transparent',
  },
```

### Step 2: Run TabletResponsive tests

```bash
npx jest --watchAll=false --testPathPattern="TabletResponsive" --verbose 2>&1 | tail -20
```

Expected: **All tests pass** (including new swipe zone tests).

### Step 3: Commit

```bash
git add src/layout/TabletResponsive.tsx
git commit -m "feat(EPIC-0004): add swipe-down gesture zone and isDownwardSwipe to TabletResponsive"
```

---

## Task 5: Update App.tsx integration

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/App.tsx`

### Step 1: Update CommandPalette import and usage

Find and replace the `handlePaletteSelect` callback:

**Old:**
```typescript
const handlePaletteSelect = useCallback((cmd: Command) => {
  setShowPalette(false);
  cmd.action();
}, []);
```

**New** (no change needed — this is still correct):
```typescript
const handlePaletteSelect = useCallback((cmd: Command) => {
  setShowPalette(false);
  cmd.action();
}, []);
```

Find and replace the `TabletResponsive` usage — add `onOpenPalette` prop:

**Old:**
```tsx
<TabletResponsive
  sidebar={...}
  main={...}
  terminal={...}
  terminalHeight={terminalHeight}
  onTerminalHeightChange={setTerminalHeight}
/>
```

**New:**
```tsx
<TabletResponsive
  sidebar={...}
  main={...}
  terminal={...}
  terminalHeight={terminalHeight}
  onTerminalHeightChange={setTerminalHeight}
  onOpenPalette={() => setShowPalette(true)}
/>
```

Find and replace the conditional CommandPalette render at the bottom:

**Old:**
```tsx
{showPalette && (
  <CommandPalette
    commands={paletteCommands}
    onSelect={handlePaletteSelect}
  />
)}
```

**New:**
```tsx
<CommandPalette
  visible={showPalette}
  commands={paletteCommands}
  onClose={() => setShowPalette(false)}
  onSelect={handlePaletteSelect}
/>
```

### Step 2: Run full test suite

```bash
npx jest --watchAll=false 2>&1 | tail -10
```

Expected: **All tests pass** (282 + new tests).

### Step 3: Check coverage for CommandPalette

```bash
npx jest --watchAll=false --testPathPattern="CommandPalette" --coverage --coverageReporters=text 2>&1 | grep "CommandPalette"
```

Expected: Statements ≥ 95%, Branches 100%, Lines ≥ 95%.

### Step 4: Commit

```bash
git add App.tsx
git commit -m "feat(EPIC-0004): update App.tsx to visible/onClose API + wire onOpenPalette gesture"
```

---

## Task 6: Update plan-status.json, RELEASE_PLAN.md, ID_REGISTRY.md

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/Docs/plan-status.json` (relative path from repo root: `Docs/plan-status.json`)
- Modify: `Docs/RELEASE_PLAN.md`
- Modify: `Docs/ID_REGISTRY.md`

### Step 1: Mark EPIC-0004 done in Docs/plan-status.json

Find the EPIC-0004 entry and set `"status": "Done"`. Find US-0015, US-0016, US-0017 and set each to `"status": "Done"`. Find AC-0046 through AC-0053 and mark each `"done": true`.

### Step 2: Mark ACs checked in Docs/RELEASE_PLAN.md

Change all `- [ ] AC-004x` under EPIC-0004 to `- [x] AC-004x`.

### Step 3: Update ID_REGISTRY.md

The tests added new TCs. Update the TC sequence — count new tests (22 CommandPalette + ~10 TabletResponsive swipe = ~32 new TCs). Current last: TC-0162. New last: TC-0194.

```markdown
| TC | TC-0195 | TC-0194 |
```

### Step 4: Regenerate the plan dashboard

```bash
cd /Users/Kamal_Syed/Projects/NomadCode
node tools/generate-plan.js
```

### Step 5: Commit everything

```bash
git add Docs/plan-status.json Docs/RELEASE_PLAN.md Docs/ID_REGISTRY.md Docs/plan-status.html Docs/AI_COST_LOG.md
git commit -m "chore(EPIC-0004): mark all ACs done, update plan-status, ID registry"
```

---

## Task 7: Update progress.md and create PR

### Step 1: Update progress.md

Update the "Next Session Pick-up" and "Current State" sections to reflect EPIC-0004 completion.

### Step 2: Run final full test suite

```bash
cd mobile-ide/mobile-ide-prototype
npx jest --watchAll=false 2>&1 | tail -5
```

Expected: All tests pass, no failures.

### Step 3: Commit progress.md and push

```bash
git add progress.md Docs/AI_COST_LOG.md
git commit -m "chore: update progress.md for EPIC-0004 completion"
git push -u origin feature/epic-0004-command-palette
```

### Step 4: Create PR

```bash
gh pr create \
  --title "feat(EPIC-0004): command palette — rebuild with visible/onClose, keyboard nav, swipe gesture" \
  --body "$(cat <<'EOF'
## Summary
- Rebuilt `CommandPalette` with standard `visible`/`onClose` Modal API
- Fixed CP-1: Android back button no longer silently fires first command
- Fixed CP-2: Backdrop tap now closes the palette (not just dismisses keyboard)
- Added keyboard up/down navigation with Nomad Blue selection highlight
- Added `PanResponder` swipe-down gesture zone in `TabletResponsive`
- All 8 ACs (AC-0046–AC-0053) now have explicitly named tests
- 22 CommandPalette tests + swipe zone tests in TabletResponsive

## Test Plan
- [ ] `npx jest --watchAll=false` — all tests pass
- [ ] CommandPalette coverage ≥ 95% statements
- [ ] Swipe zone renders and gesture fires `onOpenPalette`
- [ ] Back button on Android dismisses palette, not selects command
- [ ] Backdrop tap closes palette

Closes EPIC-0004 (US-0015, US-0016, US-0017)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
  --base develop
```

---

## Quick Reference

| Command | Purpose |
|---|---|
| `npx jest --watchAll=false --testPathPattern="CommandPalette" --verbose` | Run CommandPalette tests only |
| `npx jest --watchAll=false --testPathPattern="TabletResponsive" --verbose` | Run TabletResponsive tests only |
| `npx jest --watchAll=false` | Run full suite |
| `node tools/generate-plan.js` | Regenerate HTML dashboard |
