import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import BlameDetailSheet from '../../src/components/git/BlameDetailSheet';
import type { BlameLine } from '../../src/types/git';

jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({ bg: '#0F172A', text: '#E2E8F0', border: '#1e293b', accent: '#2563EB', textMuted: '#94a3b8' }),
}));

const blameLine: BlameLine = {
  lineNumber: 5,
  commitHash: 'a1b2c3d',
  author: 'Alice',
  timestamp: new Date('2026-01-01').getTime(),
  message: 'feat: add authentication',
};

describe('BlameDetailSheet', () => {
  it('renders nothing when not visible', () => {
    const { queryByTestId } = render(
      <BlameDetailSheet visible={false} blame={blameLine} onClose={jest.fn()} onViewDiff={jest.fn()} />,
    );
    expect(queryByTestId('blame-sheet')).toBeNull();
  });

  it('shows commit hash when visible', () => {
    const { getByText } = render(
      <BlameDetailSheet visible blame={blameLine} onClose={jest.fn()} onViewDiff={jest.fn()} />,
    );
    expect(getByText('a1b2c3d')).toBeTruthy();
  });

  it('shows author name', () => {
    const { getByText } = render(
      <BlameDetailSheet visible blame={blameLine} onClose={jest.fn()} onViewDiff={jest.fn()} />,
    );
    expect(getByText('Alice')).toBeTruthy();
  });

  it('shows commit message', () => {
    const { getByText } = render(
      <BlameDetailSheet visible blame={blameLine} onClose={jest.fn()} onViewDiff={jest.fn()} />,
    );
    expect(getByText('feat: add authentication')).toBeTruthy();
  });

  it('calls onViewDiff when View Diff is pressed', () => {
    const onViewDiff = jest.fn();
    const { getByTestId } = render(
      <BlameDetailSheet visible blame={blameLine} onClose={jest.fn()} onViewDiff={onViewDiff} />,
    );
    fireEvent.press(getByTestId('view-diff-btn'));
    expect(onViewDiff).toHaveBeenCalledWith('a1b2c3d');
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <BlameDetailSheet visible blame={blameLine} onClose={onClose} onViewDiff={jest.fn()} />,
    );
    fireEvent.press(getByTestId('blame-sheet-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
