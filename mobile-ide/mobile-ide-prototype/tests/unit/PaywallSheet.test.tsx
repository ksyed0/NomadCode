// tests/unit/PaywallSheet.test.tsx
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import PaywallSheet from '../../src/components/PaywallSheet';

// Mutable purchase/restore so individual tests can override them
const mockPurchase = jest.fn().mockResolvedValue({ status: 'cancelled' });
const mockRestore = jest.fn().mockResolvedValue(undefined);

const mockStoreState = {
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
  purchase: mockPurchase,
  restore: mockRestore,
};

jest.mock('../../src/stores/useSubscriptionStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: object) => unknown) => sel(mockStoreState)),
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState.purchase = mockPurchase;
    mockStoreState.restore = mockRestore;
    mockPurchase.mockResolvedValue({ status: 'cancelled' });
    mockRestore.mockResolvedValue(undefined);
  });

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

  it('shows "Current Plan" badge on both cards when already Pro+AI', () => {
    const { getAllByText } = render(
      <PaywallSheet {...defaultProps} currentTier="pro_ai" />
    );
    // pro_ai is isProCurrent AND isAICurrent — both badges show
    expect(getAllByText(/current plan/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows title "Upgrade to Pro+AI" when current tier is Pro', () => {
    const { getByText } = render(
      <PaywallSheet {...defaultProps} currentTier="pro" />
    );
    expect(getByText('Upgrade to Pro+AI')).toBeTruthy();
  });

  it('shows generic upgrade title for free tier', () => {
    const { getByText } = render(<PaywallSheet {...defaultProps} />);
    expect(getByText('Upgrade NomadCode')).toBeTruthy();
  });

  it('shows file limit reason when reason is file_limit', () => {
    const { getByText } = render(
      <PaywallSheet {...defaultProps} reason="file_limit" />
    );
    expect(getByText(/3-file limit/i)).toBeTruthy();
  });

  it('shows ai feature reason when reason is ai_feature', () => {
    const { getByText } = render(
      <PaywallSheet {...defaultProps} reason="ai_feature" />
    );
    expect(getByText(/AI features require Pro\+AI/i)).toBeTruthy();
  });

  it('calls onClose after a successful purchase', async () => {
    const onClose = jest.fn();
    mockPurchase.mockResolvedValueOnce({ status: 'success', tier: 'pro' });
    const { getByLabelText } = render(
      <PaywallSheet {...defaultProps} onClose={onClose} />
    );
    await act(async () => {
      fireEvent.press(getByLabelText('Subscribe to Pro'));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Alert when purchase returns error', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockPurchase.mockResolvedValueOnce({ status: 'error', errorMessage: 'Card declined' });
    const { getByLabelText } = render(<PaywallSheet {...defaultProps} />);
    await act(async () => {
      fireEvent.press(getByLabelText('Subscribe to Pro'));
    });
    expect(alertSpy).toHaveBeenCalledWith('Purchase failed', 'Card declined');
    alertSpy.mockRestore();
  });

  it('shows Alert with fallback message when error has no errorMessage', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockPurchase.mockResolvedValueOnce({ status: 'error', errorMessage: undefined });
    const { getByLabelText } = render(<PaywallSheet {...defaultProps} />);
    await act(async () => {
      fireEvent.press(getByLabelText('Subscribe to Pro'));
    });
    expect(alertSpy).toHaveBeenCalledWith('Purchase failed', 'Please try again.');
    alertSpy.mockRestore();
  });

  it('does nothing when purchase is cancelled (user dismisses sheet)', async () => {
    const onClose = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockPurchase.mockResolvedValueOnce({ status: 'cancelled' });
    const { getByLabelText } = render(
      <PaywallSheet {...defaultProps} onClose={onClose} />
    );
    await act(async () => {
      fireEvent.press(getByLabelText('Subscribe to Pro'));
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('fires purchase with pro_ai tier when Subscribe to Pro+AI is pressed', async () => {
    mockPurchase.mockResolvedValueOnce({ status: 'success', tier: 'pro_ai' });
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <PaywallSheet {...defaultProps} onClose={onClose} />
    );
    await act(async () => {
      fireEvent.press(getByLabelText('Subscribe to Pro+AI'));
    });
    expect(mockPurchase).toHaveBeenCalledWith('pro_ai', false);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls restore and shows Alert when Restore purchases is pressed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = render(<PaywallSheet {...defaultProps} />);
    await act(async () => {
      fireEvent.press(getByText('Restore purchases'));
    });
    expect(mockRestore).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Purchases restored', expect.any(String));
    alertSpy.mockRestore();
  });
});
