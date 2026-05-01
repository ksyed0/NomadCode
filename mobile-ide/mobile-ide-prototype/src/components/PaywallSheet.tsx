// src/components/PaywallSheet.tsx
import React, { useState, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, useWindowDimensions, ScrollView,
} from 'react-native';
import { useTheme } from '../theme/tokens';
import useSubscriptionStore from '../stores/useSubscriptionStore';
import type { SubscriptionTier } from '../iap/entitlements';

interface PaywallSheetProps {
  visible: boolean;
  onClose: () => void;
  currentTier: SubscriptionTier;
  /** Optional context shown above the title. */
  reason?: 'file_limit' | 'ai_feature';
}

const ANNUAL_SAVING = 'Save 37%';

export default function PaywallSheet({
  visible, onClose, currentTier, reason,
}: PaywallSheetProps) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [annual, setAnnual] = useState(false);
  const [busy, setBusy] = useState(false);

  const purchase = useSubscriptionStore((s) => s.purchase);
  const restore = useSubscriptionStore((s) => s.restore);
  const offerings = useSubscriptionStore((s) => s.offerings);

  const allPackages = offerings.flatMap((o) => o.packages);
  const proMonthly  = allPackages.find((p) => p.tier === 'pro'    && p.period === 'monthly');
  const proAnnual   = allPackages.find((p) => p.tier === 'pro'    && p.period === 'annual');
  const aiMonthly   = allPackages.find((p) => p.tier === 'pro_ai' && p.period === 'monthly');
  const aiAnnual    = allPackages.find((p) => p.tier === 'pro_ai' && p.period === 'annual');

  const proPrice = (annual ? proAnnual?.price : proMonthly?.price) ?? (annual ? '$59.99' : '$7.99');
  const aiPrice  = (annual ? aiAnnual?.price  : aiMonthly?.price)  ?? (annual ? '$119.99' : '$14.99');

  const handlePurchase = useCallback(async (tier: 'pro' | 'pro_ai') => {
    setBusy(true);
    const result = await purchase(tier, annual);
    setBusy(false);
    if (result.status === 'success') {
      onClose();
    } else if (result.status === 'error') {
      Alert.alert('Purchase failed', result.errorMessage ?? 'Please try again.');
    }
    // cancelled: do nothing (user dismissed native sheet)
  }, [purchase, annual, onClose]);

  const handleRestore = useCallback(async () => {
    setBusy(true);
    await restore();
    setBusy(false);
    Alert.alert('Purchases restored', 'Your subscription status has been updated.');
  }, [restore]);

  if (!visible) return null;

  const isProCurrent = currentTier === 'pro' || currentTier === 'pro_ai';
  const isAICurrent  = currentTier === 'pro_ai';

  const s = StyleSheet.create({
    overlay:     { flex: 1, backgroundColor: '#00000088', justifyContent: isTablet ? 'center' : 'flex-end', alignItems: isTablet ? 'center' : 'stretch' },
    sheet:       { backgroundColor: t.bgElevated, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderRadius: isTablet ? 16 : undefined, width: isTablet ? 520 : undefined, maxHeight: '85%', paddingBottom: 24 },
    handle:      { width: 44, height: 4, backgroundColor: t.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
    reason:      { color: '#D97706', fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
    title:       { color: t.text, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 4, paddingHorizontal: 24 },
    toggle:      { flexDirection: 'row', backgroundColor: t.bg, borderRadius: 8, margin: 16, padding: 3 },
    toggleBtn:   { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
    toggleText:  { fontSize: 13, fontWeight: '600' },
    savingBadge: { fontSize: 10, fontWeight: '700', color: '#22C55E' },
    cardsRow:    { flexDirection: isTablet ? 'row' : 'column', gap: 12, paddingHorizontal: 16 },
    card:        { flex: 1, backgroundColor: t.bg, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: t.border },
    cardAI:      { borderColor: '#0D9488', borderWidth: 2 },
    cardHeader:  { fontSize: 16, fontWeight: '700', marginBottom: 4 },
    cardPrice:   { fontSize: 24, fontWeight: '800', marginBottom: 2 },
    cardPeriod:  { fontSize: 11, color: t.textMuted, marginBottom: 10 },
    cardFeature: { fontSize: 12, color: t.textMuted, marginBottom: 2 },
    cta:         { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 12, minHeight: 44, justifyContent: 'center' },
    currentBadge:{ backgroundColor: t.bgHighlight, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 12 },
    currentText: { fontSize: 12, fontWeight: '600', color: t.textMuted },
    footer:      { paddingHorizontal: 24, paddingTop: 16, alignItems: 'center', gap: 8 },
    restore:     { color: t.accent, fontSize: 13 },
    terms:       { color: t.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 14 },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <ScrollView style={s.sheet} showsVerticalScrollIndicator={false}>
            <View style={s.handle} />

            {reason === 'file_limit' && (
              <Text style={s.reason}>Free plan: 3-file limit reached</Text>
            )}
            {reason === 'ai_feature' && (
              <Text style={s.reason}>AI features require Pro+AI</Text>
            )}

            <Text style={s.title}>
              {currentTier === 'pro' ? 'Upgrade to Pro+AI' : 'Upgrade NomadCode'}
            </Text>

            {/* Monthly / Annual toggle */}
            <View style={s.toggle}>
              {(['Monthly', 'Annual'] as const).map((label) => {
                const isActive = annual === (label === 'Annual');
                return (
                  <TouchableOpacity
                    key={label}
                    style={[s.toggleBtn, isActive && { backgroundColor: t.bgElevated }]}
                    onPress={() => setAnnual(label === 'Annual')}
                  >
                    <Text style={[s.toggleText, { color: isActive ? t.text : t.textMuted }]}>
                      {label}
                    </Text>
                    {label === 'Annual' && <Text style={s.savingBadge}>{ANNUAL_SAVING}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.cardsRow}>
              {/* Pro card */}
              <View style={s.card}>
                <Text style={[s.cardHeader, { color: '#2563EB' }]}>Pro</Text>
                <Text style={[s.cardPrice, { color: t.text }]}>{proPrice}</Text>
                <Text style={s.cardPeriod}>{annual ? 'per year' : 'per month'}</Text>
                {['Unlimited open files', 'Full git workflow', 'All editor features'].map((f) => (
                  <Text key={f} style={s.cardFeature}>· {f}</Text>
                ))}
                {isProCurrent ? (
                  <View style={s.currentBadge}>
                    <Text style={s.currentText}>Current Plan</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[s.cta, { backgroundColor: '#2563EB' }]}
                    onPress={() => handlePurchase('pro')}
                    disabled={busy}
                    accessibilityLabel="Subscribe to Pro"
                  >
                    {busy
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Subscribe to Pro</Text>
                    }
                  </TouchableOpacity>
                )}
              </View>

              {/* Pro+AI card */}
              <View style={[s.card, s.cardAI]}>
                <Text style={[s.cardHeader, { color: '#0D9488' }]}>Pro+AI</Text>
                <Text style={[s.cardPrice, { color: t.text }]}>{aiPrice}</Text>
                <Text style={s.cardPeriod}>{annual ? 'per year' : 'per month'}</Text>
                {['Everything in Pro', 'AI code completions', 'AI chat panel'].map((f) => (
                  <Text key={f} style={s.cardFeature}>· {f}</Text>
                ))}
                {isAICurrent ? (
                  <View style={s.currentBadge}>
                    <Text style={s.currentText}>Current Plan</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[s.cta, { backgroundColor: '#0D9488' }]}
                    onPress={() => handlePurchase('pro_ai')}
                    disabled={busy}
                    accessibilityLabel="Subscribe to Pro+AI"
                  >
                    {busy
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Subscribe to Pro+AI</Text>
                    }
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={s.footer}>
              <TouchableOpacity
                onPress={handleRestore}
                disabled={busy}
                accessibilityLabel="Restore purchases"
              >
                <Text style={s.restore}>Restore purchases</Text>
              </TouchableOpacity>
              <Text style={s.terms}>
                Auto-renews. Cancel anytime in iOS Settings. Prices shown in USD.
              </Text>
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
