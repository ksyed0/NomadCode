// src/stores/useSubscriptionStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as iapService from '../iap/iapService';
import { tierFromEntitlements } from '../iap/entitlements';
import type { SubscriptionTier } from '../iap/entitlements';
import type { PurchaseOffering, PurchaseResult } from '../iap/iapService';

interface SubscriptionState {
  /** Persisted — available instantly on launch without a network call. */
  tier: SubscriptionTier;
  isLoading: boolean;
  error: string | null;
  /** Available subscription packages fetched from RevenueCat (not persisted). */
  offerings: PurchaseOffering[];

  /**
   * Fetch current entitlements + offerings from RevenueCat.
   * Call once on app launch alongside useAuthStore.hydrate().
   * Silently keeps the cached tier on network failure.
   */
  hydrate(): Promise<void>;

  /**
   * Trigger a purchase for the given tier and billing period.
   * Finds the matching package in `offerings` and calls iapService.purchase().
   */
  purchase(tier: 'pro' | 'pro_ai', annual: boolean): Promise<PurchaseResult>;

  /**
   * Restore previous purchases. Required by App Store guidelines.
   * Call when the user taps "Restore purchases" in PaywallSheet.
   */
  restore(): Promise<void>;
}

const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      tier: 'free',
      isLoading: false,
      error: null,
      offerings: [],

      hydrate: async () => {
        set({ isLoading: true, error: null });
        try {
          const [entitlements, offerings] = await Promise.all([
            iapService.getActiveEntitlements(),
            iapService.getOfferings(),
          ]);
          set({ tier: tierFromEntitlements(entitlements), offerings, isLoading: false });
        } catch {
          // Network failure — preserve the cached tier so offline use still works.
          set({ isLoading: false });
        }
      },

      purchase: async (tier: 'pro' | 'pro_ai', annual: boolean) => {
        const { offerings } = get();
        const targetPeriod = annual ? 'annual' : 'monthly';
        const pkg = offerings
          .flatMap((o) => o.packages)
          .find((p) => p.tier === tier && p.period === targetPeriod);

        if (!pkg) {
          return { status: 'error', errorMessage: 'Package not available. Pull to refresh.' };
        }

        set({ isLoading: true, error: null });
        const result = await iapService.purchase(pkg.packageId);

        if (result.status === 'success' && result.tier) {
          set({ tier: result.tier, isLoading: false });
        } else if (result.status === 'error') {
          set({ isLoading: false, error: result.errorMessage ?? 'Purchase failed.' });
        } else {
          // cancelled — no error, no tier change
          set({ isLoading: false });
        }
        return result;
      },

      restore: async () => {
        set({ isLoading: true, error: null });
        try {
          const restoredTier = await iapService.restorePurchases();
          set({ tier: restoredTier, isLoading: false });
        } catch (e) {
          set({
            isLoading: false,
            error: e instanceof Error ? e.message : 'Restore failed.',
          });
        }
      },
    }),
    {
      name: 'nomadcode-subscription',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist `tier` — offerings are always re-fetched on launch.
      partialize: (state) => ({ tier: state.tier }),
    },
  ),
);

export default useSubscriptionStore;
