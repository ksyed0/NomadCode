// src/iap/entitlements.ts

export type SubscriptionTier = 'free' | 'pro' | 'pro_ai';

/** Maximum number of simultaneously open file tabs on the Free tier. */
export const FREE_FILE_LIMIT = 3;

/**
 * Returns true if the user may open another file tab.
 * Pro and Pro+AI have no limit; Free is capped at FREE_FILE_LIMIT.
 */
export function canOpenMoreFiles(openCount: number, tier: SubscriptionTier): boolean {
  return tier !== 'free' || openCount < FREE_FILE_LIMIT;
}

/** Returns true if the user has access to AI features (gated by EPIC-0010). */
export function hasAIAccess(tier: SubscriptionTier): boolean {
  return tier === 'pro_ai';
}

/** Human-readable display label for the tier. */
export function tierLabel(tier: SubscriptionTier): string {
  const labels: Record<SubscriptionTier, string> = {
    free: 'Free',
    pro: 'Pro',
    pro_ai: 'Pro+AI',
  };
  return labels[tier];
}

/** Design-system accent colour for the tier pill. */
export function tierColor(tier: SubscriptionTier): string {
  const colours: Record<SubscriptionTier, string> = {
    free: '#64748B',
    pro: '#2563EB',
    pro_ai: '#0D9488',
  };
  return colours[tier];
}

/**
 * Derives the subscription tier from a list of active RevenueCat entitlement IDs.
 * `pro_ai` is checked first because it is the higher tier.
 */
export function tierFromEntitlements(activeEntitlementIds: string[]): SubscriptionTier {
  if (activeEntitlementIds.includes('pro_ai')) return 'pro_ai';
  if (activeEntitlementIds.includes('pro')) return 'pro';
  return 'free';
}
