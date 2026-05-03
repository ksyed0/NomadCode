// tests/unit/PaywallAISheet.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PaywallAISheet from '../../src/components/PaywallAISheet';

const mockTheme = {
  bg: '#0F172A', bgElevated: '#1E293B', bgHighlight: '#334155',
  text: '#E2E8F0', textMuted: '#64748B', accent: '#0D9488',
  border: '#334155', error: '#EF4444',
};
jest.mock('../../src/theme/tokens', () => ({ useTheme: () => mockTheme }));

describe('PaywallAISheet', () => {
  it('renders Pro+AI Feature heading', () => {
    const { getByText } = render(<PaywallAISheet reason="builtin" onUpgrade={jest.fn()} />);
    expect(getByText('Pro+AI Feature')).toBeTruthy();
  });

  it('renders pricing text', () => {
    const { getByText } = render(<PaywallAISheet reason="builtin" onUpgrade={jest.fn()} />);
    expect(getByText(/\$14\.99\/mo/)).toBeTruthy();
  });

  it('calls onUpgrade when Upgrade button is tapped', () => {
    const onUpgrade = jest.fn();
    const { getByText } = render(<PaywallAISheet reason="builtin" onUpgrade={onUpgrade} />);
    fireEvent.press(getByText('Upgrade to Pro+AI'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('renders feature list items', () => {
    const { getByText } = render(<PaywallAISheet reason="builtin" onUpgrade={jest.fn()} />);
    expect(getByText(/Inline code completions/)).toBeTruthy();
    expect(getByText(/AI chat/)).toBeTruthy();
  });
});

describe('reason prop', () => {
  it('shows Pro+AI heading and price for reason="builtin"', () => {
    const { getByText } = render(
      <PaywallAISheet reason="builtin" onUpgrade={jest.fn()} />
    );
    expect(getByText('Pro+AI Feature')).toBeTruthy();
    expect(getByText('Upgrade to Pro+AI')).toBeTruthy();
    expect(getByText('$14.99/mo · $119.99/yr')).toBeTruthy();
  });

  it('shows Pro heading and price for reason="byok"', () => {
    const { getByText } = render(
      <PaywallAISheet reason="byok" onUpgrade={jest.fn()} />
    );
    expect(getByText('Pro Feature')).toBeTruthy();
    expect(getByText('Upgrade to Pro')).toBeTruthy();
    expect(getByText('$7.99/mo · $59.99/yr')).toBeTruthy();
  });

  it('shows different feature lists for builtin vs byok', () => {
    const { getByText: getBuiltin } = render(
      <PaywallAISheet reason="builtin" onUpgrade={jest.fn()} />
    );
    expect(getBuiltin(/200\+ models/i)).toBeTruthy();

    const { getByText: getByok } = render(
      <PaywallAISheet reason="byok" onUpgrade={jest.fn()} />
    );
    expect(getByok(/own API key/i)).toBeTruthy();
  });
});
