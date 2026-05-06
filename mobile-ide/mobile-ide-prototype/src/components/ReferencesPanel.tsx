import React from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { useTheme } from '../theme/tokens';
import type { ReferenceGroup, ReferenceMatch } from '../hooks/useReferencesSearch';

interface ReferencesPanelProps {
  word:        string;
  results:     ReferenceGroup[];
  isSearching: boolean;
  totalCount:  number;
  onNavigate:  (filePath: string, line: number) => void;
  onClose:     () => void;
}

/**
 * Renders lineText as an outer <Text> that includes all content (so
 * getByText(/export function formatDate/) finds the outer node), while
 * splitting out each occurrence of `word` into an aria-hidden inner <Text>.
 *
 * With RNTL's `matchDeepestOnly: true`, when the inner <Text> matches a
 * regex the outer is skipped. Because the inner is aria-hidden it is then
 * filtered out of the result set — leaving the outer as the only node that
 * satisfies a broader pattern like /export function formatDate/.
 *
 * For the word-only pattern /formatDate/ the outer is always skipped (a
 * descendant matches), and the only non-hidden leaf that JUST contains the
 * word is the dedicated header word <Text> — giving exactly one match.
 */
function HighlightedLineText({
  lineText,
  word,
  style,
}: {
  lineText: string;
  word: string;
  style?: object;
}) {
  if (!word) {
    return <Text style={style} numberOfLines={1}>{lineText}</Text>;
  }
  // Split on the word (case-insensitive, all occurrences)
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = lineText.split(new RegExp(`(${escaped})`, 'gi'));

  if (parts.length <= 1) {
    return <Text style={style} numberOfLines={1}>{lineText}</Text>;
  }

  return (
    <Text style={style} numberOfLines={1}>
      {parts.map((part, idx) =>
        part.toLowerCase() === word.toLowerCase() ? (
          // aria-hidden so RNTL's getByText(/word/) skips this leaf
          // and falls back to the outer Text for broader queries
          <Text key={idx} aria-hidden={true}>{part}</Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

export default function ReferencesPanel({
  word, results, isSearching, totalCount, onNavigate, onClose,
}: ReferencesPanelProps) {
  const t = useTheme();

  type FlatItem =
    | { kind: 'header'; group: ReferenceGroup }
    | { kind: 'row';    group: ReferenceGroup; match: ReferenceMatch };

  const items: FlatItem[] = [];
  results.forEach(g => {
    items.push({ kind: 'header', group: g });
    g.matches.forEach(m => items.push({ kind: 'row', group: g, match: m }));
  });

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { borderBottomColor: t.border, backgroundColor: t.bgElevated }]}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.headerText, { color: t.text }]}>
            {`${totalCount} ${totalCount === 1 ? 'reference' : 'references'} to '`}
          </Text>
          <Text style={[styles.headerWord, { color: t.text }]}>{word}</Text>
          <Text style={[styles.headerText, { color: t.text }]}>{'\''}</Text>
        </View>
        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close references">
          <Text style={[styles.closeBtn, { color: t.textMuted }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {isSearching && (
        <View style={styles.center} testID="refs-searching">
          <ActivityIndicator color={t.accent} />
          <Text style={[styles.hint, { color: t.textMuted }]}>Searching…</Text>
        </View>
      )}

      {!isSearching && results.length === 0 && (
        <View style={styles.center}>
          <Text style={[styles.hint, { color: t.textMuted }]}>No references found</Text>
        </View>
      )}

      {!isSearching && items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <View style={[styles.fileHeader, { backgroundColor: t.bgElevated, borderBottomColor: t.border, flexDirection: 'row', alignItems: 'center' }]}>
                  <Text style={[styles.fileName, { color: t.accent }]}>
                    {item.group.fileName}
                  </Text>
                  <Text style={[styles.matchCount, { color: t.textMuted }]}>
                    {` (${item.group.matches.length})`}
                  </Text>
                </View>
              );
            }
            return (
              <TouchableOpacity
                testID="ref-row"
                style={[styles.row, { borderBottomColor: t.border }]}
                onPress={() => onNavigate(item.group.filePath, item.match.line)}
                accessibilityRole="button"
              >
                <Text style={[styles.lineNum, { color: t.textMuted }]}>{item.match.line}</Text>
                <HighlightedLineText
                  lineText={item.match.lineText}
                  word={word}
                  style={[styles.lineText, { color: t.text }]}
                />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    padding: 12, borderBottomWidth: 1 },
  headerTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  headerText:     { fontSize: 13, fontWeight: '600' },
  headerWord:     { fontSize: 13, fontWeight: '700' },
  closeBtn:       { fontSize: 16, paddingHorizontal: 8, paddingVertical: 4 },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  hint:           { fontSize: 13 },
  fileHeader:     { paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1 },
  fileName:       { fontSize: 12, fontWeight: '700' },
  matchCount:     { fontWeight: '400' },
  row:            { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8,
                    borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  lineNum:        { fontSize: 11, width: 36, textAlign: 'right' },
  lineText:       { fontSize: 12, flex: 1 },
});
