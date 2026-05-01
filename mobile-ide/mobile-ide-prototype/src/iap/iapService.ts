// src/iap/iapService.ts
/**
 * iapService — thin adapter around the RevenueCat SDK.
 *
 * This is the ONLY file in the codebase that imports react-native-purchases.
 * All other code uses this module, making the IAP library swappable by
 * replacing only this file.
 */
import Purchases, { PURCHASES_ERROR_CODE } from 'react-native-purchases';
import type { SubscriptionTier } from './entitlements';
import { tierFromEntitlements } from './entitlements';

// ---------------------------------------------------------------------------
// Public types (other modules import these, never RevenueCat types directly)
// ---------------------------------------------------------------------------

export interface IAPPackage {
  /** RevenueCat package identifier, e.g. '$rc_monthly' or a custom ID. */
  packageId: string;
  /** App Store / Play Store product ID, e.g. 'com.nomadcode.pro.monthly'. */
  productId: string;
  /** Localised formatted price string, e.g. '$7.99'. */
  price: string;
  period: 'monthly' | 'annual';
  tier: 'pro' | 'pro_ai';
}

export interface PurchaseOffering {
  offeringId: string;
  packages: IAPPackage[];
}

export type PurchaseStatus = 'success' | 'cancelled' | 'error';

export interface PurchaseResult {
  status: PurchaseStatus;
  /** Set on success — the new tier derived from updated entitlements. */
  tier?: SubscriptionTier;
  /** Set on error — human-readable message suitable for an Alert. */
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type RCPackage = {
  identifier: string;
  packageType: string;
  product: { identifier: string; priceString: string };
};

function rcPackageToIAP(pkg: RCPackage): IAPPackage {
  const isAnnual = pkg.packageType === 'ANNUAL' ||
    pkg.product.identifier.includes('annual');
  const tier: 'pro' | 'pro_ai' = pkg.product.identifier.includes('proai')
    ? 'pro_ai'
    : 'pro';
  return {
    packageId: pkg.identifier,
    productId: pkg.product.identifier,
    price: pkg.product.priceString,
    period: isAnnual ? 'annual' : 'monthly',
    tier,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise RevenueCat. Call once on app boot before any other IAP function.
 * Use Platform.select to pass the correct iOS or Android key.
 */
export function configure(apiKey: string): void {
  Purchases.configure({ apiKey });
}

/**
 * Fetches available subscription packages from RevenueCat.
 * RevenueCat caches this locally — fast on subsequent calls.
 * Returns an empty array on network failure (caller shows cached prices).
 */
export async function getOfferings(): Promise<PurchaseOffering[]> {
  try {
    const offerings = await Purchases.getOfferings();
    if (!offerings.current) return [];
    return [{
      offeringId: offerings.current.identifier,
      packages: (offerings.current.availablePackages as RCPackage[]).map(rcPackageToIAP),
    }];
  } catch {
    return [];
  }
}

/**
 * Returns active RevenueCat entitlement IDs for the current user.
 * Uses the cached CustomerInfo — safe to call on every app launch.
 */
export async function getActiveEntitlements(): Promise<string[]> {
  const info = await Purchases.getCustomerInfo();
  return Object.keys(info.entitlements.active);
}

/**
 * Triggers the native IAP purchase sheet for the given RevenueCat package ID.
 * RevenueCat validates the receipt server-side automatically.
 *
 * Returns `cancelled` (no error shown) when the user dismisses the native sheet.
 */
export async function purchase(packageId: string): Promise<PurchaseResult> {
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = (offerings.current?.availablePackages as RCPackage[] | undefined)
      ?.find((p) => p.identifier === packageId);
    if (!pkg) {
      return { status: 'error', errorMessage: 'Package not available. Pull to refresh.' };
    }
    const { customerInfo } = await Purchases.purchasePackage(pkg as never);
    const activeIds = Object.keys((customerInfo as { entitlements: { active: Record<string, unknown> } }).entitlements.active);
    const tier = tierFromEntitlements(activeIds);
    return { status: 'success', tier };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { status: 'cancelled' };
    }
    return {
      status: 'error',
      errorMessage: (e instanceof Error ? e.message : String(e)) || 'Purchase failed.',
    };
  }
}

/**
 * Restores previous purchases. Required by App Store guidelines.
 * Always call this when the user taps "Restore purchases".
 */
export async function restorePurchases(): Promise<SubscriptionTier> {
  const info = await Purchases.restorePurchases();
  const activeIds = Object.keys(
    (info as { entitlements: { active: Record<string, unknown> } }).entitlements.active
  );
  return tierFromEntitlements(activeIds);
}
