// tests/unit/iapService.test.ts
/**
 * Tests for src/iap/iapService.ts — the thin RevenueCat adapter.
 * The react-native-purchases mock lives in __mocks__/react-native-purchases.js.
 */

import Purchases, { PURCHASES_ERROR_CODE } from 'react-native-purchases';
import {
  configure,
  getOfferings,
  getActiveEntitlements,
  purchase,
  restorePurchases,
} from '../../src/iap/iapService';

const mockPurchases = Purchases as jest.Mocked<typeof Purchases>;

// Typed helpers for casting mock functions
const getOfferingsMock = mockPurchases.getOfferings as jest.Mock;
const getCustomerInfoMock = mockPurchases.getCustomerInfo as jest.Mock;
const purchasePackageMock = mockPurchases.purchasePackage as jest.Mock;
const restorePurchasesMock = mockPurchases.restorePurchases as jest.Mock;
const configureMock = mockPurchases.configure as jest.Mock;

const makePackage = (id: string, productId: string, type: 'MONTHLY' | 'ANNUAL' = 'MONTHLY') => ({
  identifier: id,
  packageType: type,
  product: { identifier: productId, priceString: type === 'ANNUAL' ? '$59.99' : '$7.99' },
});

const makeOfferings = (packages: ReturnType<typeof makePackage>[]) => ({
  current: {
    identifier: 'default',
    availablePackages: packages,
  },
});

describe('iapService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // configure
  // ---------------------------------------------------------------------------
  describe('configure', () => {
    it('calls Purchases.configure with the provided API key', () => {
      configure('test-api-key');
      expect(configureMock).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });
  });

  // ---------------------------------------------------------------------------
  // getOfferings
  // ---------------------------------------------------------------------------
  describe('getOfferings', () => {
    it('returns empty array when offerings.current is null', async () => {
      getOfferingsMock.mockResolvedValueOnce({ current: null });
      const result = await getOfferings();
      expect(result).toEqual([]);
    });

    it('returns mapped packages for a valid current offering', async () => {
      const pkgs = [
        makePackage('$rc_monthly', 'com.nomadcode.pro.monthly', 'MONTHLY'),
        makePackage('$rc_annual', 'com.nomadcode.pro.annual', 'ANNUAL'),
        makePackage('$rc_ai_m', 'com.nomadcode.proai.monthly', 'MONTHLY'),
      ];
      getOfferingsMock.mockResolvedValueOnce(makeOfferings(pkgs));

      const result = await getOfferings();
      expect(result).toHaveLength(1);
      expect(result[0].offeringId).toBe('default');
      expect(result[0].packages).toHaveLength(3);

      const monthly = result[0].packages[0];
      expect(monthly.period).toBe('monthly');
      expect(monthly.tier).toBe('pro');
      expect(monthly.price).toBe('$7.99');

      const annual = result[0].packages[1];
      expect(annual.period).toBe('annual');
      expect(annual.tier).toBe('pro');
    });

    it('detects pro_ai tier from product identifier', async () => {
      const pkgs = [makePackage('ai_m', 'com.nomadcode.proai.monthly', 'MONTHLY')];
      getOfferingsMock.mockResolvedValueOnce(makeOfferings(pkgs));

      const result = await getOfferings();
      expect(result[0].packages[0].tier).toBe('pro_ai');
    });

    it('detects annual period from product identifier when packageType is not ANNUAL', async () => {
      const pkgs = [{
        identifier: 'annual_pkg',
        packageType: 'CUSTOM' as ReturnType<typeof makePackage>['packageType'],
        product: { identifier: 'com.nomadcode.pro.annual', priceString: '$59.99' },
      }];
      getOfferingsMock.mockResolvedValueOnce(makeOfferings(pkgs));

      const result = await getOfferings();
      expect(result[0].packages[0].period).toBe('annual');
    });

    it('returns empty array when Purchases.getOfferings throws', async () => {
      getOfferingsMock.mockRejectedValueOnce(new Error('Network error'));
      const result = await getOfferings();
      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getActiveEntitlements
  // ---------------------------------------------------------------------------
  describe('getActiveEntitlements', () => {
    it('returns empty array when no entitlements are active', async () => {
      getCustomerInfoMock.mockResolvedValueOnce({ entitlements: { active: {} } });
      const result = await getActiveEntitlements();
      expect(result).toEqual([]);
    });

    it('returns entitlement ids when active entitlements exist', async () => {
      getCustomerInfoMock.mockResolvedValueOnce({
        entitlements: { active: { pro: {}, pro_ai: {} } },
      });
      const result = await getActiveEntitlements();
      expect(result).toContain('pro');
      expect(result).toContain('pro_ai');
      expect(result).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // purchase
  // ---------------------------------------------------------------------------
  describe('purchase', () => {
    it('returns error when the package is not found in offerings', async () => {
      getOfferingsMock.mockResolvedValueOnce(makeOfferings([]));
      const result = await purchase('nonexistent_pkg');
      expect(result.status).toBe('error');
      expect(result.errorMessage).toMatch(/not available/i);
    });

    it('returns error when offerings.current is null', async () => {
      getOfferingsMock.mockResolvedValueOnce({ current: null });
      const result = await purchase('some_pkg');
      expect(result.status).toBe('error');
    });

    it('returns success with derived tier after successful purchase', async () => {
      const pkg = makePackage('pro_m', 'com.nomadcode.pro.monthly');
      getOfferingsMock.mockResolvedValueOnce(makeOfferings([pkg]));
      purchasePackageMock.mockResolvedValueOnce({
        customerInfo: { entitlements: { active: { pro: {} } } },
      });

      const result = await purchase('pro_m');
      expect(result.status).toBe('success');
      expect(result.tier).toBe('pro');
    });

    it('returns success with pro_ai tier after successful Pro+AI purchase', async () => {
      const pkg = makePackage('ai_m', 'com.nomadcode.proai.monthly');
      getOfferingsMock.mockResolvedValueOnce(makeOfferings([pkg]));
      purchasePackageMock.mockResolvedValueOnce({
        customerInfo: { entitlements: { active: { pro_ai: {} } } },
      });

      const result = await purchase('ai_m');
      expect(result.status).toBe('success');
      expect(result.tier).toBe('pro_ai');
    });

    it('returns cancelled when user dismisses native sheet', async () => {
      const pkg = makePackage('pro_m', 'com.nomadcode.pro.monthly');
      getOfferingsMock.mockResolvedValueOnce(makeOfferings([pkg]));
      const cancelErr = { code: PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR };
      purchasePackageMock.mockRejectedValueOnce(cancelErr);

      const result = await purchase('pro_m');
      expect(result.status).toBe('cancelled');
      expect(result.errorMessage).toBeUndefined();
    });

    it('returns error on non-cancellation purchase error (Error instance)', async () => {
      const pkg = makePackage('pro_m', 'com.nomadcode.pro.monthly');
      getOfferingsMock.mockResolvedValueOnce(makeOfferings([pkg]));
      purchasePackageMock.mockRejectedValueOnce(new Error('Store problem'));

      const result = await purchase('pro_m');
      expect(result.status).toBe('error');
      expect(result.errorMessage).toBe('Store problem');
    });

    it('returns error on non-cancellation purchase error (non-Error value)', async () => {
      const pkg = makePackage('pro_m', 'com.nomadcode.pro.monthly');
      getOfferingsMock.mockResolvedValueOnce(makeOfferings([pkg]));
      purchasePackageMock.mockRejectedValueOnce('raw string error');

      const result = await purchase('pro_m');
      expect(result.status).toBe('error');
      expect(result.errorMessage).toBe('raw string error');
    });
  });

  // ---------------------------------------------------------------------------
  // restorePurchases
  // ---------------------------------------------------------------------------
  describe('restorePurchases', () => {
    it('returns free tier when no entitlements are restored', async () => {
      restorePurchasesMock.mockResolvedValueOnce({
        entitlements: { active: {} },
      });
      const tier = await restorePurchases();
      expect(tier).toBe('free');
    });

    it('returns pro tier when pro entitlement is restored', async () => {
      restorePurchasesMock.mockResolvedValueOnce({
        entitlements: { active: { pro: {} } },
      });
      const tier = await restorePurchases();
      expect(tier).toBe('pro');
    });

    it('returns pro_ai tier when pro_ai entitlement is restored', async () => {
      restorePurchasesMock.mockResolvedValueOnce({
        entitlements: { active: { pro_ai: {} } },
      });
      const tier = await restorePurchases();
      expect(tier).toBe('pro_ai');
    });
  });
});
