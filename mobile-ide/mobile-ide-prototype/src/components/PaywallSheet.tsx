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

  // Tablet sizing — see BUG-0057. Phone keeps the bottom-sheet form factor;
  // tablet renders a centred dialog card with larger typography so the layout
  // breathes on a 1024pt+ viewport instead of stretching to full screen height.
  const s = StyleSheet.create({
    overlay:     { flex: 1, backgroundColor: '#00000088', justifyContent: isTablet ? 'center' : 'flex-end', alignItems: isTablet ? 'center' : 'stretch', padding: isTablet ? 32 : 0 },
    sheet:       {
      backgroundColor: t.bgElevated,
      borderTopLeftRadius: isTablet ? 20 : 16,
      borderTopRightRadius: isTablet ? 20 : 16,
      borderBottomLeftRadius: isTablet ? 20 : 0,
      borderBottomRightRadius: isTablet ? 20 : 0,
      width: isTablet ? 680 : undefined,
      maxHeight: isTablet ? '80%' : '85%',
      paddingBottom: isTablet ? 32 : 24,
    },
    sheetContent: { paddingHorizontal: isTablet ? 8 : 0 },
    handle:      { width: 44, height: 4, backgroundColor: t.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16, opacity: isTablet ? 0 : 1 },
    reason:      { color: '#D97706', fontSize: isTablet ? 14 : 12, fontWeight: '600', textAlign: 'center', marginTop: isTablet ? 24 : 0, marginBottom: isTablet ? 8 : 4 },
    title:       { color: t.text, fontSize: isTablet ? 28 : 20, fontWeight: '700', textAlign: 'center', marginBottom: isTablet ? 8 : 4, paddingHorizontal: 24 },
    toggle:      { flexDirection: 'row', backgroundColor: t.bg, borderRadius: 10, margin: isTablet ? 24 : 16, padding: 4 },
    toggleBtn:   { flex: 1, paddingVertical: isTablet ? 10 : 8, borderRadius: 7, alignItems: 'center' },
    toggleText:  { fontSize: isTablet ? 15 : 13, fontWeight: '600' },
    savingBadge: { fontSize: isTablet ? 11 : 10, fontWeight: '700', color: '#22C55E', marginTop: 2 },
    cardsRow:    { flexDirection: isTablet ? 'row' : 'column', gap: isTablet ? 20 : 12, paddingHorizontal: isTablet ? 24 : 16 },
    card:        { flex: 1, backgroundColor: t.bg, borderRadius: isTablet ? 16 : 12, padding: isTablet ? 24 : 16, borderWidth: 1, borderColor: t.border },
    cardAI:      { borderColor: '#0D9488', borderWidth: 2 },
    cardHeader:  { fontSize: isTablet ? 20 : 16, fontWeight: '700', marginBottom: isTablet ? 6 : 4, letterSpacing: 0.3 },
    cardPrice:   { fontSize: isTablet ? 40 : 24, fontWeight: '800', marginBottom: 2, letterSpacing: -0.5 },
    cardPeriod:  { fontSize: isTablet ? 13 : 11, color: t.textMuted, marginBottom: isTablet ? 16 : 10 },
    cardFeature: { fontSize: isTablet ? 14 : 12, color: t.textMuted, marginBottom: isTablet ? 4 : 2, lineHeight: isTablet ? 20 : 16 },
    cta:         { borderRadius: isTablet ? 12 : 10, paddingVertical: isTablet ? 16 : 14, alignItems: 'center', marginTop: isTablet ? 18 : 12, minHeight: 44, justifyContent: 'center' },
    ctaText:     { color: '#fff', fontWeight: '700', fontSize: isTablet ? 16 : 15 },
    currentBadge:{ backgroundColor: t.bgHighlight, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 12 },
    currentText: { fontSize: 12, fontWeight: '600', color: t.textMuted },
    footer:      { paddingHorizontal: 24, paddingTop: isTablet ? 24 : 16, alignItems: 'center', gap: isTablet ? 12 : 8 },
    restore:     { color: t.accent, fontSize: isTablet ? 14 : 13, fontWeight: '600' },
    terms:       { color: t.textMuted, fontSize: isTablet ? 11 : 10, textAlign: 'center', lineHeight: isTablet ? 16 : 14, maxWidth: 480 },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={isTablet ? { width: 680, maxHeight: '100%' } : undefined}>
          <ScrollView
            style={s.sheet}
            contentContainerStyle={isTablet ? { paddingBottom: 8 } : undefined}
            showsVerticalScrollIndicator={false}
          >
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
                      : <Text style={s.ctaText}>Subscribe to Pro</Text>
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
                      : <Text style={s.ctaText}>Subscribe to Pro+AI</Text>
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
