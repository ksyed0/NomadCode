import React from 'react';
import { render } from '@testing-library/react-native';
import SubscriptionBadge from '../../src/components/SubscriptionBadge';

jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bg: '#0F172A', bgElevated: '#1E293B', text: '#E2E8F0',
    textMuted: '#64748B', border: '#334155', accent: '#2563EB',
  }),
}));

describe('SubscriptionBadge', () => {
  it('renders "Free" for the free tier', () => {
    const { getByText } = render(<SubscriptionBadge tier="free" />);
    expect(getByText('Free')).toBeTruthy();
  });

  it('renders "Pro" for the pro tier', () => {
    const { getByText } = render(<SubscriptionBadge tier="pro" />);
    expect(getByText('Pro')).toBeTruthy();
  });

  it('renders "Pro+AI" for the pro_ai tier', () => {
    const { getByText } = render(<SubscriptionBadge tier="pro_ai" />);
    expect(getByText('Pro+AI')).toBeTruthy();
  });

  it('renders upgrade button when showUpgradeButton is true', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <SubscriptionBadge tier="free" showUpgradeButton onUpgradePress={onPress} />
    );
    expect(getByText(/upgrade/i)).toBeTruthy();
  });

  it('does not render upgrade button when showUpgradeButton is false', () => {
    const { queryByText } = render(
      <SubscriptionBadge tier="pro_ai" showUpgradeButton={false} />
    );
    expect(queryByText(/upgrade/i)).toBeNull();
  });

  it('does not render upgrade button by default', () => {
    const { queryByText } = render(<SubscriptionBadge tier="free" />);
    expect(queryByText(/upgrade/i)).toBeNull();
  });
});
