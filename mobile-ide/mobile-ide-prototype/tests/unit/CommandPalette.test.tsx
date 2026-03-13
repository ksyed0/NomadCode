/**
 * Unit tests — CommandPalette component (EPIC-0004)
 *
 * Covers all 8 acceptance criteria (AC-0046 – AC-0053) explicitly,
 * plus keyboard navigation, dismiss behaviour, and edge cases.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Modal } from 'react-native';
import { CommandPalette, Command } from '../../src/components/CommandPalette';

// Mock useTheme so CommandPalette can render without a real Zustand store
jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bg: '#0F172A',
    bgElevated: '#1E293B',
    bgHighlight: '#1D3461',
    text: '#E2E8F0',
    textMuted: '#64748B',
    border: '#334155',
    accent: '#2563EB',
    keyword: '#7C3AED',
    string: '#0D9488',
    error: '#EF4444',
    success: '#22C55E',
  }),
}));

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
    const { onClose } = renderPalette();
    fireEvent.press(screen.getByTestId('palette-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop press does not call onSelect', () => {
    const { onSelect } = renderPalette();
    fireEvent.press(screen.getByTestId('palette-backdrop'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('onRequestClose calls onClose, not onSelect (Android back button fix)', () => {
    const { onClose, onSelect } = renderPalette();
    const modal = screen.UNSAFE_getByType(Modal);
    act(() => { modal.props.onRequestClose(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
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

  it('AC-0049: filters case-insensitively with uppercase query', () => {
    renderPalette();
    fireEvent.changeText(screen.getByPlaceholderText(/Search commands/i), 'GIT');
    expect(screen.getByText('Git: Show Status')).toBeTruthy();
    expect(screen.queryByText('File: Save')).toBeNull();
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
    const allShortcutTexts = screen
      .queryAllByText(/^[⌘⌃⌥⇧].+/)
      .map((el) => el.props.children);
    expect(allShortcutTexts).toEqual(expect.arrayContaining(['⌘S', '⌘`']));
    expect(allShortcutTexts).toHaveLength(2);
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

  it('ArrowUp after two ArrowDowns lands on the second item', () => {
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
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-save' }));
  });

  it('ArrowDown on last item stays on last item', () => {
    const { onSelect } = renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
    // Press ArrowDown 10 times — should clamp at last item (index 3 for 4-item fixture)
    for (let i = 0; i < 10; i++) {
      fireEvent(input, 'keyPress', { nativeEvent: { key: 'ArrowDown' } });
    }
    fireEvent(input, 'submitEditing');
    // Last item in makeCommands() is 'git-status' (index 3)
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'git-status' }));
  });

  it('query change resets selectedIndex to 0', () => {
    const { onSelect } = renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'ArrowDown' } });
    fireEvent.changeText(input, 'git');
    fireEvent(input, 'submitEditing');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'git-status' }));
  });

  it('item at selectedIndex renders with Nomad Blue highlight style', () => {
    renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
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
