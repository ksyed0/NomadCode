// tests/unit/useSubscriptionStore.test.ts
import useSubscriptionStore from '../../src/stores/useSubscriptionStore';

// Mock AsyncStorage (same pattern as useSettingsStore tests)
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

// iapService is the mock boundary — never import react-native-purchases in tests
jest.mock('../../src/iap/iapService', () => ({
  getActiveEntitlements: jest.fn().mockResolvedValue([]),
  getOfferings: jest.fn().mockResolvedValue([]),
  purchase: jest.fn(),
  restorePurchases: jest.fn(),
}));

import * as iapService from '../../src/iap/iapService';

const mockGetEntitlements = iapService.getActiveEntitlements as jest.Mock;
const mockGetOfferings = iapService.getOfferings as jest.Mock;
const mockPurchase = iapService.purchase as jest.Mock;
const mockRestore = iapService.restorePurchases as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Reset store state between tests
  useSubscriptionStore.setState({
    tier: 'free',
    isLoading: false,
    error: null,
    offerings: [],
  });
});

describe('hydrate', () => {
  it('sets tier to free when no entitlements', async () => {
    mockGetEntitlements.mockResolvedValue([]);
    mockGetOfferings.mockResolvedValue([]);
    await useSubscriptionStore.getState().hydrate();
    expect(useSubscriptionStore.getState().tier).toBe('free');
  });

  it('sets tier to pro when pro entitlement active', async () => {
    mockGetEntitlements.mockResolvedValue(['pro']);
    mockGetOfferings.mockResolvedValue([]);
    await useSubscriptionStore.getState().hydrate();
    expect(useSubscriptionStore.getState().tier).toBe('pro');
  });

  it('sets tier to pro_ai when pro_ai entitlement active', async () => {
    mockGetEntitlements.mockResolvedValue(['pro_ai']);
    await useSubscriptionStore.getState().hydrate();
    expect(useSubscriptionStore.getState().tier).toBe('pro_ai');
  });

  it('keeps cached tier on network failure', async () => {
    useSubscriptionStore.setState({ tier: 'pro' });
    mockGetEntitlements.mockRejectedValue(new Error('network'));
    mockGetOfferings.mockRejectedValue(new Error('network'));
    await useSubscriptionStore.getState().hydrate();
    expect(useSubscriptionStore.getState().tier).toBe('pro');
    expect(useSubscriptionStore.getState().isLoading).toBe(false);
  });

  it('populates offerings from iapService', async () => {
    const fakeOffering = [{ offeringId: 'default', packages: [] }];
    mockGetEntitlements.mockResolvedValue([]);
    mockGetOfferings.mockResolvedValue(fakeOffering);
    await useSubscriptionStore.getState().hydrate();
    expect(useSubscriptionStore.getState().offerings).toEqual(fakeOffering);
  });
});

describe('purchase', () => {
  const proPackage = {
    packageId: 'com.nomadcode.pro.monthly',
    productId: 'com.nomadcode.pro.monthly',
    price: '$7.99',
    period: 'monthly' as const,
    tier: 'pro' as const,
  };

  beforeEach(() => {
    useSubscriptionStore.setState({
      offerings: [{ offeringId: 'default', packages: [proPackage] }],
    });
  });

  it('updates tier to pro on successful purchase', async () => {
    mockPurchase.mockResolvedValue({ status: 'success', tier: 'pro' });
    await useSubscriptionStore.getState().purchase('pro', false);
    expect(useSubscriptionStore.getState().tier).toBe('pro');
  });

  it('returns cancelled result without setting error', async () => {
    mockPurchase.mockResolvedValue({ status: 'cancelled' });
    const result = await useSubscriptionStore.getState().purchase('pro', false);
    expect(result.status).toBe('cancelled');
    expect(useSubscriptionStore.getState().error).toBeNull();
  });

  it('sets error on purchase failure', async () => {
    mockPurchase.mockResolvedValue({ status: 'error', errorMessage: 'Payment failed' });
    await useSubscriptionStore.getState().purchase('pro', false);
    expect(useSubscriptionStore.getState().error).toBe('Payment failed');
  });

  it('returns error when package not found in offerings', async () => {
    useSubscriptionStore.setState({ offerings: [] });
    const result = await useSubscriptionStore.getState().purchase('pro', false);
    expect(result.status).toBe('error');
    expect(mockPurchase).not.toHaveBeenCalled();
  });
});

describe('restore', () => {
  it('updates tier from restored entitlements', async () => {
    mockRestore.mockResolvedValue('pro');
    await useSubscriptionStore.getState().restore();
    expect(useSubscriptionStore.getState().tier).toBe('pro');
  });

  it('sets error on restore failure', async () => {
    mockRestore.mockRejectedValue(new Error('Network error'));
    await useSubscriptionStore.getState().restore();
    expect(useSubscriptionStore.getState().error).toContain('Network error');
  });
});
