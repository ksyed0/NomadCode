import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSearch } from '../hooks/useSearch';
import { useTheme } from '../theme/tokens';

export interface GlobalSearchProps {
  workspaceRoot: string;
  onNavigate: (filePath: string, lineNumber: number, matchStart: number, matchEnd: number) => void;
}

function ToggleButton({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.toggle,
        {
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primary + '33' : 'transparent',
        },
      ]}
    >
      <Text style={{ color: active ? colors.primary : colors.textMuted, fontSize: 11 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function GlobalSearch({ workspaceRoot, onNavigate }: GlobalSearchProps) {
  const {
    query, setQuery, options, setOptions,
    results, isSearching, fileCount, totalMatchCount, error,
    submit, clear,
  } = useSearch(workspaceRoot);
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search input row */}
      <View style={[styles.inputRow, { borderColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submit}
          placeholder="Search"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clear} style={styles.clearBtn}>
            <Text style={{ color: colors.textMuted }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Toggle buttons */}
      <View style={styles.toggleRow}>
        <ToggleButton
          label="Aa"
          active={options.caseSensitive}
          onPress={() => setOptions({ caseSensitive: !options.caseSensitive })}
        />
        <ToggleButton
          label=".*"
          active={options.regex}
          onPress={() => setOptions({ regex: !options.regex })}
        />
        <ToggleButton
          label="\b"
          active={options.wholeWord}
          onPress={() => setOptions({ wholeWord: !options.wholeWord })}
        />
      </View>

      {/* Glob filter */}
      <TextInput
        style={[styles.globInput, { color: colors.text, borderColor: colors.border }]}
        value={options.glob}
        onChangeText={(g) => setOptions({ glob: g })}
        placeholder="files to include (e.g. **/*.ts)"
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
      />

      {/* Status */}
      {error ? (
        <Text style={[styles.statusText, { color: colors.error }]}>{error}</Text>
      ) : isSearching ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.statusText, { color: colors.textMuted }]}>
            {' '}Searching... ({fileCount} files scanned)
          </Text>
        </View>
      ) : results.length > 0 ? (
        <Text style={[styles.statusText, { color: colors.textMuted }]}>
          {totalMatchCount} result{totalMatchCount !== 1 ? 's' : ''} in {results.length} file{results.length !== 1 ? 's' : ''}
        </Text>
      ) : null}

      {/* Results list */}
      <ScrollView style={styles.resultList} keyboardShouldPersistTaps="handled">
        {!isSearching && results.length === 0 && query.length > 0 && !error && (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No results found</Text>
        )}
        {results.map((fileResult) => (
          <View key={fileResult.filePath}>
            <Text
              style={[styles.filePath, { color: colors.accent }]}
              numberOfLines={1}
            >
              {fileResult.filePath}
            </Text>
            {fileResult.matches.map((match) => (
              <TouchableOpacity
                key={`${fileResult.filePath}:${match.lineNumber}`}
                onPress={() => onNavigate(fileResult.filePath, match.lineNumber, match.matchStart, match.matchEnd)}
                style={styles.matchRow}
              >
                <Text style={[styles.lineNum, { color: colors.textMuted }]}>
                  {match.lineNumber}
                </Text>
                <Text style={[styles.preview, { color: colors.text }]} numberOfLines={1}>
                  {match.preview}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: 8 },
  input: { flex: 1, height: 36, fontFamily: 'JetBrains Mono', fontSize: 13 },
  clearBtn: { padding: 6 },
  toggleRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  toggle: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 3, borderWidth: 1 },
  globInput: { marginHorizontal: 8, marginBottom: 4, height: 30, fontSize: 11, borderBottomWidth: 1 },
  statusText: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  resultList: { flex: 1 },
  emptyText: { paddingHorizontal: 12, paddingVertical: 8, fontSize: 12 },
  filePath: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 2, fontSize: 11, fontWeight: '600' },
  matchRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 3, gap: 8 },
  lineNum: { fontSize: 11, width: 32, textAlign: 'right' },
  preview: { flex: 1, fontSize: 12, fontFamily: 'JetBrains Mono' },
});
