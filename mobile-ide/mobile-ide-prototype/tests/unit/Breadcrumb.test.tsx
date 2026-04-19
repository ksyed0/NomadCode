import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Breadcrumb } from '../../src/components/Breadcrumb';

// ---------------------------------------------------------------------------
// Mock theme tokens (avoid AsyncStorage pull-in via useSettingsStore)
// ---------------------------------------------------------------------------

jest.mock('../../src/theme/tokens', () => {
  const actual = jest.requireActual('../../src/theme/tokens');
  return {
    ...actual,
    useTheme: () => actual.THEMES['nomad-dark'],
  };
});

jest.mock('../../src/stores/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: object) => unknown) =>
    sel({ fontSize: 14, theme: 'nomad-dark', setFontSize: jest.fn() })
  ),
}));

// ---------------------------------------------------------------------------

describe('Breadcrumb', () => {
  const segments = ['src', 'components', 'Editor.tsx'];

  it('renders all path segments', () => {
    render(<Breadcrumb segments={segments} symbol={null} onSegmentPress={jest.fn()} />);
    expect(screen.getByText('src')).toBeTruthy();
    expect(screen.getByText('components')).toBeTruthy();
    expect(screen.getByText('Editor.tsx')).toBeTruthy();
  });

  it('renders symbol when provided', () => {
    render(<Breadcrumb segments={segments} symbol="handleMessage" onSegmentPress={jest.fn()} />);
    expect(screen.getByText('handleMessage')).toBeTruthy();
  });

  it('symbol is not shown when null', () => {
    render(<Breadcrumb segments={segments} symbol={null} onSegmentPress={jest.fn()} />);
    expect(screen.queryByTestId('breadcrumb-symbol')).toBeNull();
  });

  it('calls onSegmentPress with correct index', () => {
    const onSegmentPress = jest.fn();
    render(<Breadcrumb segments={segments} symbol={null} onSegmentPress={onSegmentPress} />);
    fireEvent.press(screen.getByText('components'));
    expect(onSegmentPress).toHaveBeenCalledWith(1, expect.any(String));
  });
});
