import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/tokens';

interface BreadcrumbProps {
  segments: string[];
  symbol: string | null;
  onSegmentPress: (index: number, parentPath: string) => void;
}

export function Breadcrumb({ segments, symbol, onSegmentPress }: BreadcrumbProps) {
  const theme = useTheme();

  return (
    <View testID="editor-path-breadcrumb" style={[styles.container, { backgroundColor: theme.bgElevated, borderBottomColor: theme.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {segments.map((seg, i) => (
          <React.Fragment key={`${seg}-${i}`}>
            {i > 0 && <Text style={[styles.sep, { color: theme.textMuted }]}> › </Text>}
            <TouchableOpacity onPress={() => {
              const parentPath = segments.slice(0, i + 1).join('/');
              onSegmentPress(i, parentPath);
            }}>
              <Text style={[styles.seg, { color: i === segments.length - 1 ? theme.text : theme.textMuted }]}>
                {seg}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
        {symbol && (
          <>
            <Text style={[styles.sep, { color: theme.textMuted }]}> › </Text>
            <Text testID="breadcrumb-symbol" style={[styles.seg, { color: theme.accent }]}>{symbol}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 28, borderBottomWidth: StyleSheet.hairlineWidth },
  scroll: { alignItems: 'center', paddingHorizontal: 8 },
  seg: { fontSize: 12 },
  sep: { fontSize: 12 },
});
