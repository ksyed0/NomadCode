// src/components/PaywallAISheet.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/tokens';

interface PaywallAISheetProps {
  reason: 'builtin' | 'byok';
  onUpgrade: () => void;
}

const BUILTIN_FEATURES = [
  'Inline code completions',
  'AI chat with file context',
  '200+ models via OpenRouter',
  'Free models — unlimited use',
];

const BYOK_FEATURES = [
  'Use your own API key',
  'OpenRouter, Claude, Gemini, OpenAI support',
  'No daily quota — unlimited use',
  'Custom / local models (Ollama, LM Studio)',
];

export default function PaywallAISheet({ reason, onUpgrade }: PaywallAISheetProps) {
  const t = useTheme();
  const isBuiltin = reason === 'builtin';
  const features  = isBuiltin ? BUILTIN_FEATURES : BYOK_FEATURES;
  const heading   = isBuiltin ? 'Pro+AI Feature' : 'Pro Feature';
  const planName  = isBuiltin ? 'Pro+AI' : 'Pro';
  const price     = isBuiltin ? '$14.99/mo · $119.99/yr' : '$7.99/mo · $59.99/yr';

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.iconTile, { backgroundColor: t.bgElevated }]}>
        <Text style={styles.lockIcon}>🔒</Text>
      </View>

      <Text style={[styles.heading, { color: t.text }]}>{heading}</Text>
      <Text style={[styles.description, { color: t.textMuted }]}>
        {isBuiltin
          ? <Text>Inline suggestions and chat are included in the <Text style={{ color: t.accent }}>Pro+AI</Text> plan.</Text>
          : <Text>Bring Your Own Key is included in the <Text style={{ color: t.accent }}>Pro</Text> plan.</Text>
        }
      </Text>

      <View style={[styles.featureBox, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
        <Text style={[styles.featureLabel, { color: t.textMuted }]}>What you get</Text>
        {features.map((f) => (
          <Text key={f} style={[styles.featureItem, { color: t.text }]}>
            ✦ {f}
          </Text>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.upgradeBtn, { backgroundColor: t.accent }]}
        onPress={onUpgrade}
        accessibilityRole="button"
        accessibilityLabel={`Upgrade to ${planName}`}
      >
        <Text style={styles.upgradeBtnText}>Upgrade to {planName}</Text>
      </TouchableOpacity>

      <Text style={[styles.price, { color: t.textMuted }]}>{price}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 16 },
  iconTile:       { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lockIcon:       { fontSize: 26 },
  heading:        { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  description:    { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  featureBox:     { width: '100%', borderRadius: 10, borderWidth: 1, padding: 14, gap: 6 },
  featureLabel:   { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  featureItem:    { fontSize: 13, lineHeight: 20 },
  upgradeBtn:     { width: '100%', borderRadius: 10, padding: 14, alignItems: 'center' },
  upgradeBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  price:          { fontSize: 12 },
});
