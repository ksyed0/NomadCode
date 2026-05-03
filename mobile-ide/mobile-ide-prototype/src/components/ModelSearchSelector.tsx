// src/components/ModelSearchSelector.tsx
import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/tokens';
import type { OpenRouterModel } from '../ai/aiProvider';

interface ModelSearchSelectorProps {
  models: OpenRouterModel[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
  loading: boolean;
  disabled?: boolean;
}

function isFreeModel(model: OpenRouterModel): boolean {
  return model.pricing.prompt === '0' && model.pricing.completion === '0';
}

function formatPrice(model: OpenRouterModel): string {
  if (isFreeModel(model)) return 'FREE';
  const outPer1M = (parseFloat(model.pricing.completion) * 1_000_000).toFixed(2);
  return `$${outPer1M}/1M out`;
}

function providerLabel(modelId: string): string {
  return modelId.split('/')[0] ?? modelId;
}

export default function ModelSearchSelector({
  models, selectedModel, onSelect, loading, disabled,
}: ModelSearchSelectorProps) {
  const t = useTheme();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) return models;
    const q = query.toLowerCase();
    return models.filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
    );
  }, [models, query]);

  if (loading) {
    return (
      <View style={styles.loader} testID="models-loading">
        <ActivityIndicator color={t.accent} />
        <Text style={[styles.loaderText, { color: t.textMuted }]}>Loading models…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <TextInput
        style={[styles.input, { backgroundColor: t.bgElevated, borderColor: t.border, color: t.text }]}
        placeholder="Search models..."
        placeholderTextColor={t.textMuted}
        value={query}
        onChangeText={setQuery}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const selected = item.id === selectedModel;
          const free     = isFreeModel(item);
          return (
            <TouchableOpacity
              style={[
                styles.row,
                { borderBottomColor: t.border },
                selected && { backgroundColor: t.bgHighlight },
              ]}
              onPress={() => !disabled && onSelect(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`Select model ${item.name}`}
            >
              <View style={styles.rowInfo}>
                <Text style={[styles.modelName, { color: t.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.provider, { color: t.textMuted }]}>
                  {providerLabel(item.id)}
                </Text>
              </View>
              {free ? (
                <View style={[styles.freeBadge, { backgroundColor: t.accent + '22' }]}>
                  <Text style={[styles.freeBadgeText, { color: t.accent }]}>FREE</Text>
                </View>
              ) : (
                <Text style={[styles.priceText, { color: t.textMuted }]}>
                  {formatPrice(item)}
                </Text>
              )}
            </TouchableOpacity>
          );
        }}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  input:         { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12,
                   paddingVertical: 10, fontSize: 14, margin: 12 },
  row:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                   paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  rowInfo:       { flex: 1, marginRight: 8 },
  modelName:     { fontSize: 13, fontWeight: '600' },
  provider:      { fontSize: 11, marginTop: 2 },
  freeBadge:     { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  freeBadgeText: { fontSize: 10, fontWeight: '700' },
  priceText:     { fontSize: 11 },
  loader:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  loaderText:    { fontSize: 12 },
});
