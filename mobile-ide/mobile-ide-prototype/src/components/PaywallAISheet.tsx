// src/components/PaywallAISheet.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/tokens';

interface PaywallAISheetProps {
  onUpgrade: () => void;
}

const FEATURES = [
  'Inline code completions',
  'AI chat with file context',
  '3 built-in provider choices',
  'Custom model support',
];

export default function PaywallAISheet({ onUpgrade }: PaywallAISheetProps) {
  const t = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.iconTile, { backgroundColor: t.bgElevated }]}>
        <Text style={styles.lockIcon}>🔒</Text>
      </View>

      <Text style={[styles.heading, { color: t.text }]}>Pro+AI Feature</Text>
      <Text style={[styles.description, { color: t.textMuted }]}>
        Inline suggestions and chat are included in the{' '}
        <Text style={{ color: t.accent }}>Pro+AI</Text> plan.
      </Text>

      <View style={[styles.featureBox, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
        <Text style={[styles.featureLabel, { color: t.textMuted }]}>What you get</Text>
        {FEATURES.map((f) => (
          <Text key={f} style={[styles.featureItem, { color: t.text }]}>
            ✦ {f}
          </Text>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.upgradeBtn, { backgroundColor: t.accent }]}
        onPress={onUpgrade}
        accessibilityRole="button"
        accessibilityLabel="Upgrade to Pro+AI"
      >
        <Text style={styles.upgradeBtnText}>Upgrade to Pro+AI</Text>
      </TouchableOpacity>

      <Text style={[styles.price, { color: t.textMuted }]}>$14.99/mo · $119.99/yr</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 16 },
  iconTile:       { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lockIcon:       { fontSize: 26 },
  heading:        { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  description:    { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  featureBox:     { width: '100%', borderRadius: 10, padding: 12, borderWidth: 1, gap: 6 },
  featureLabel:   { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  featureItem:    { fontSize: 13 },
  upgradeBtn:     { width: '100%', borderRadius: 10, padding: 14, alignItems: 'center' },
  upgradeBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  price:          { fontSize: 12 },
});
