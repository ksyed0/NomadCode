// tests/unit/PaywallSheet.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PaywallSheet from '../../src/components/PaywallSheet';

jest.mock('../../src/stores/useSubscriptionStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: object) => unknown) =>
    sel({
      tier: 'free',
      isLoading: false,
      error: null,
      offerings: [
        {
          offeringId: 'default',
          packages: [
            { packageId: 'pro_m', productId: 'com.nomadcode.pro.monthly',  price: '$7.99',   period: 'monthly', tier: 'pro' },
            { packageId: 'pro_a', productId: 'com.nomadcode.pro.annual',   price: '$59.99',  period: 'annual',  tier: 'pro' },
            { packageId: 'ai_m',  productId: 'com.nomadcode.proai.monthly', price: '$14.99', period: 'monthly', tier: 'pro_ai' },
            { packageId: 'ai_a',  productId: 'com.nomadcode.proai.annual',  price: '$119.99',period: 'annual',  tier: 'pro_ai' },
          ],
        },
      ],
      purchase: jest.fn().mockResolvedValue({ status: 'cancelled' }),
      restore: jest.fn().mockResolvedValue(undefined),
    })
  ),
}));
jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bg: '#0F172A', bgElevated: '#1E293B', bgHighlight: '#1D3461',
    text: '#E2E8F0', textMuted: '#64748B', border: '#334155',
    accent: '#2563EB', error: '#EF4444', success: '#22C55E', mode: 'dark',
  }),
}));

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  currentTier: 'free' as const,
};

describe('PaywallSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not render when visible is false', () => {
    const { queryByText } = render(<PaywallSheet {...defaultProps} visible={false} />);
    expect(queryByText(/upgrade/i)).toBeNull();
  });

  it('renders monthly prices by default', () => {
    const { getByText } = render(<PaywallSheet {...defaultProps} />);
    expect(getByText('$7.99')).toBeTruthy();
    expect(getByText('$14.99')).toBeTruthy();
  });

  it('switches to annual prices when annual tab is selected', () => {
    const { getByText } = render(<PaywallSheet {...defaultProps} />);
    fireEvent.press(getByText('Annual'));
    expect(getByText('$59.99')).toBeTruthy();
    expect(getByText('$119.99')).toBeTruthy();
  });

  it('shows "Restore purchases" link', () => {
    const { getByText } = render(<PaywallSheet {...defaultProps} />);
    expect(getByText(/restore/i)).toBeTruthy();
  });

  it('shows subscription terms copy (Apple requirement)', () => {
    const { getByText } = render(<PaywallSheet {...defaultProps} />);
    expect(getByText(/auto-renew/i)).toBeTruthy();
  });

  it('shows "Current Plan" badge on Pro card when already Pro', () => {
    const { getByText } = render(
      <PaywallSheet {...defaultProps} currentTier="pro" />
    );
    expect(getByText(/current plan/i)).toBeTruthy();
  });

  it('shows file limit reason when reason is file_limit', () => {
    const { getByText } = render(
      <PaywallSheet {...defaultProps} reason="file_limit" />
    );
    expect(getByText(/3-file limit/i)).toBeTruthy();
  });
});
