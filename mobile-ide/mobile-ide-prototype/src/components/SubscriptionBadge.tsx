import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/tokens';
import { tierLabel, tierColor } from '../iap/entitlements';
import type { SubscriptionTier } from '../iap/entitlements';

interface SubscriptionBadgeProps {
  tier: SubscriptionTier;
  /** When true, renders an "Upgrade ↗" button alongside the badge. */
  showUpgradeButton?: boolean;
  onUpgradePress?: () => void;
}

export default function SubscriptionBadge({
  tier,
  showUpgradeButton = false,
  onUpgradePress,
}: SubscriptionBadgeProps) {
  const t = useTheme();
  const colour = tierColor(tier);
  const label = tierLabel(tier);

  return (
    <View style={styles.row}>
      <View style={[styles.badge, { backgroundColor: colour + '22', borderColor: colour + '66' }]}>
        <Text style={[styles.badgeText, { color: colour }]}>{label}</Text>
      </View>
      {showUpgradeButton && (
        <TouchableOpacity
          onPress={onUpgradePress}
          style={styles.upgradeBtn}
          accessibilityLabel="Upgrade subscription"
        >
          <Text style={[styles.upgradeText, { color: t.accent }]}>Upgrade ↗</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge:       { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:   { fontSize: 12, fontWeight: '600' },
  upgradeBtn:  { minHeight: 44, justifyContent: 'center' },
  upgradeText: { fontSize: 13, fontWeight: '500' },
});
