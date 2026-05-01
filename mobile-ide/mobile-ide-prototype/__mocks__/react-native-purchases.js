const PURCHASES_ERROR_CODE = {
  PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED',
  STORE_PROBLEM_ERROR: 'STORE_PROBLEM',
  NETWORK_ERROR: 'NETWORK_ERROR',
};

const Purchases = {
  configure: jest.fn(),
  getOfferings: jest.fn().mockResolvedValue({ current: null }),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  getCustomerInfo: jest.fn().mockResolvedValue({
    entitlements: { active: {} },
  }),
};

module.exports = {
  __esModule: true,
  default: Purchases,
  PURCHASES_ERROR_CODE,
};
