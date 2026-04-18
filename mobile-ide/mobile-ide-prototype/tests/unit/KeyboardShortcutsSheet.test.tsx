import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { KeyboardShortcutsSheet } from '../../src/components/KeyboardShortcutsSheet';
import type { ShortcutDefinition } from '../../src/hooks/useKeyboardShortcuts';

// Mock useTheme so the component can render without a real Zustand store
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

const shortcuts: ShortcutDefinition[] = [
  { key: 's', modifiers: ['cmd'], label: 'Save File', action: jest.fn() },
  { key: 'p', modifiers: ['cmd'], label: 'Command Palette', action: jest.fn() },
];

describe('KeyboardShortcutsSheet', () => {
  it('renders all shortcut labels', () => {
    render(<KeyboardShortcutsSheet visible shortcuts={shortcuts} onClose={jest.fn()} />);
    expect(screen.getByText('Save File')).toBeTruthy();
    expect(screen.getByText('Command Palette')).toBeTruthy();
  });

  it('shows key combination strings', () => {
    render(<KeyboardShortcutsSheet visible shortcuts={shortcuts} onClose={jest.fn()} />);
    expect(screen.getByText('⌘S')).toBeTruthy();
    expect(screen.getByText('⌘P')).toBeTruthy();
  });

  it('calls onClose when close button pressed', () => {
    const onClose = jest.fn();
    render(<KeyboardShortcutsSheet visible shortcuts={shortcuts} onClose={onClose} />);
    fireEvent.press(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when visible=false', () => {
    render(<KeyboardShortcutsSheet visible={false} shortcuts={shortcuts} onClose={jest.fn()} />);
    expect(screen.queryByText('Save File')).toBeNull();
  });
});
