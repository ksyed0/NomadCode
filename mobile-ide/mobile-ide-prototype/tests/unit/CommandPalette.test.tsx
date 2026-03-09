/**
 * Unit tests — CommandPalette component
 *
 * Tests search filtering, keyboard submission, shortcut badges,
 * and the empty state.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CommandPalette, Command } from '../../src/components/CommandPalette';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeCommands = (): Command[] => [
  { id: 'file-save',       label: 'File: Save',          shortcut: '⌘S',  action: jest.fn() },
  { id: 'file-close',      label: 'File: Close Tab',                       action: jest.fn() },
  { id: 'view-terminal',   label: 'View: Toggle Terminal', shortcut: '⌘`', action: jest.fn(),
    description: 'Show or hide the terminal' },
  { id: 'git-status',      label: 'Git: Show Status',                      action: jest.fn() },
];

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderPalette(onSelect = jest.fn(), commands = makeCommands()) {
  return render(<CommandPalette commands={commands} onSelect={onSelect} />);
}

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe('CommandPalette — rendering', () => {
  it('renders all commands when query is empty', () => {
    renderPalette();
    expect(screen.getByText('File: Save')).toBeTruthy();
    expect(screen.getByText('File: Close Tab')).toBeTruthy();
    expect(screen.getByText('View: Toggle Terminal')).toBeTruthy();
    expect(screen.getByText('Git: Show Status')).toBeTruthy();
  });

  it('renders shortcut badges', () => {
    renderPalette();
    expect(screen.getByText('⌘S')).toBeTruthy();
    expect(screen.getByText('⌘`')).toBeTruthy();
  });

  it('renders descriptions when provided', () => {
    renderPalette();
    expect(screen.getByText('Show or hide the terminal')).toBeTruthy();
  });

  it('renders the search input', () => {
    renderPalette();
    expect(screen.getByPlaceholderText(/Search commands/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

describe('CommandPalette — filtering', () => {
  it('filters commands by label (case-insensitive)', () => {
    renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
    fireEvent.changeText(input, 'git');

    expect(screen.getByText('Git: Show Status')).toBeTruthy();
    expect(screen.queryByText('File: Save')).toBeNull();
    expect(screen.queryByText('View: Toggle Terminal')).toBeNull();
  });

  it('filters commands by description', () => {
    renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
    fireEvent.changeText(input, 'hide the terminal');

    expect(screen.getByText('View: Toggle Terminal')).toBeTruthy();
    expect(screen.queryByText('File: Save')).toBeNull();
  });

  it('shows "No commands found" when nothing matches', () => {
    renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
    fireEvent.changeText(input, 'xyzzy');

    expect(screen.getByText(/No commands found/i)).toBeTruthy();
  });

  it('shows all commands when query is cleared', () => {
    renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
    fireEvent.changeText(input, 'git');
    fireEvent.changeText(input, '');

    expect(screen.getByText('File: Save')).toBeTruthy();
    expect(screen.getByText('Git: Show Status')).toBeTruthy();
  });

  it('matches partial substrings', () => {
    renderPalette();
    const input = screen.getByPlaceholderText(/Search commands/i);
    fireEvent.changeText(input, 'sav');

    expect(screen.getByText('File: Save')).toBeTruthy();
    expect(screen.queryByText('Git: Show Status')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe('CommandPalette — selection', () => {
  it('calls onSelect with the tapped command', () => {
    const onSelect = jest.fn();
    renderPalette(onSelect);
    fireEvent.press(screen.getByText('File: Save'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'file-save' }),
    );
  });

  it('calls onSelect with the first filtered command on Enter', () => {
    const onSelect = jest.fn();
    renderPalette(onSelect);
    const input = screen.getByPlaceholderText(/Search commands/i);
    fireEvent.changeText(input, 'git');
    fireEvent(input, 'submitEditing');
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'git-status' }),
    );
  });

  it('does not call onSelect on Enter when no commands match', () => {
    const onSelect = jest.fn();
    renderPalette(onSelect);
    const input = screen.getByPlaceholderText(/Search commands/i);
    fireEvent.changeText(input, 'xyzzy');
    fireEvent(input, 'submitEditing');
    expect(onSelect).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('CommandPalette — edge cases', () => {
  it('renders with an empty command list without crashing', () => {
    renderPalette(jest.fn(), []);
    expect(screen.getByText(/No commands found/i)).toBeTruthy();
  });
});
