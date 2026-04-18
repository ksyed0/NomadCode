import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useReplace } from '../hooks/useReplace';
import { useTheme } from '../theme/tokens';

export interface GlobalSearchProps {
  workspaceRoot: string;
  onNavigate: (filePath: string, lineNumber: number, matchStart: number, matchEnd: number) => void;
}

function ToggleButton({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.toggle,
        {
          borderColor: active ? theme.accent : theme.border,
          backgroundColor: active ? theme.accent + '33' : 'transparent',
        },
      ]}
    >
      <Text style={{ color: active ? theme.accent : theme.textMuted, fontSize: 11 }}>
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
    mode, setMode, replaceQuery, setReplaceQuery,
    excludedMatches, toggleExclude, replacePreview, replaceAll,
  } = useReplace(workspaceRoot);
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Mode tabs */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'search' && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
          onPress={() => setMode('search')}
        >
          <Text style={{ color: mode === 'search' ? theme.accent : theme.textMuted, fontSize: 11, fontWeight: '600' }}>
            SEARCH
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'replace' && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
          onPress={() => setMode('replace')}
        >
          <Text style={{ color: mode === 'replace' ? theme.accent : theme.textMuted, fontSize: 11, fontWeight: '600' }}>
            REPLACE
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search input row */}
      <View style={[styles.inputRow, { borderColor: theme.border }]}>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submit}
          placeholder="Search"
          placeholderTextColor={theme.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clear} style={styles.clearBtn}>
            <Text style={{ color: theme.textMuted }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Replace input row */}
      {mode === 'replace' && (
        <View style={[styles.inputRow, { borderColor: theme.border, marginTop: 4 }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={replaceQuery}
            onChangeText={setReplaceQuery}
            placeholder="Replace with..."
            placeholderTextColor={theme.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      )}
      {mode === 'replace' && replacePreview.length > 0 && (
        <Text style={{ color: theme.textMuted, fontSize: 11, paddingHorizontal: 8, paddingVertical: 2 }}>
          {replacePreview}
        </Text>
      )}

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
        style={[styles.globInput, { color: theme.text, borderColor: theme.border }]}
        value={options.glob}
        onChangeText={(g) => setOptions({ glob: g })}
        placeholder="files to include (e.g. **/*.ts)"
        placeholderTextColor={theme.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
      />

      {/* Status */}
      {error ? (
        <Text style={[styles.statusText, { color: theme.error }]}>{error}</Text>
      ) : isSearching ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={[styles.statusText, { color: theme.textMuted }]}>
            {' '}Searching... ({fileCount} files scanned)
          </Text>
        </View>
      ) : results.length > 0 ? (
        <Text style={[styles.statusText, { color: theme.textMuted }]}>
          {totalMatchCount} result{totalMatchCount !== 1 ? 's' : ''} in {results.length} file{results.length !== 1 ? 's' : ''}
        </Text>
      ) : null}

      {/* Replace All bar */}
      {mode === 'replace' && (
        <View style={[styles.summaryRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
          <Text style={{ color: theme.textMuted, fontSize: 12 }}>
            {totalMatchCount > 0 ? `${fileCount} files · ${totalMatchCount} matches` : 'No matches'}
          </Text>
          <TouchableOpacity
            disabled={!query || totalMatchCount === 0}
            style={[
              styles.replaceAllBtn,
              { backgroundColor: !query || totalMatchCount === 0 ? theme.border : theme.accent },
            ]}
            onPress={async () => {
              const r = await replaceAll();
              Alert.alert('Replace All', `${r.matchesReplaced} replacements in ${r.filesChanged} files.`);
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Replace All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results list */}
      <ScrollView style={styles.resultList} keyboardShouldPersistTaps="handled">
        {!isSearching && results.length === 0 && query.length > 0 && !error && (
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>No results found</Text>
        )}
        {results.map((fileResult) => (
          <View key={fileResult.filePath}>
            <Text
              style={[styles.filePath, { color: theme.accent }]}
              numberOfLines={1}
            >
              {fileResult.filePath}
            </Text>
            {fileResult.matches.map((match) => (
              <TouchableOpacity
                key={`${fileResult.filePath}:${match.lineNumber}:${match.matchStart}`}
                onPress={() =>
                  mode === 'replace'
                    ? toggleExclude(`${fileResult.filePath}:${match.lineNumber}:${match.matchStart}`)
                    : onNavigate(fileResult.filePath, match.lineNumber, match.matchStart, match.matchEnd)
                }
                style={styles.matchRow}
              >
                {mode === 'replace' && (
                  <Text style={{ color: theme.textMuted, marginRight: 6, fontSize: 12 }}>
                    {excludedMatches.has(`${fileResult.filePath}:${match.lineNumber}:${match.matchStart}`) ? '☐' : '☑'}
                  </Text>
                )}
                <Text style={[styles.lineNum, { color: theme.textMuted }]}>
                  {match.lineNumber}
                </Text>
                <Text style={[styles.preview, { color: theme.text }]} numberOfLines={1}>
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
  modeTabs: { flexDirection: 'row' },
  modeTab: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: 8 },
  input: { flex: 1, height: 36, fontFamily: 'JetBrains Mono', fontSize: 13 },
  clearBtn: { padding: 6 },
  toggleRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  toggle: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 3, borderWidth: 1 },
  globInput: { marginHorizontal: 8, marginBottom: 4, height: 30, fontSize: 11, borderBottomWidth: 1 },
  statusText: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 4 },
  replaceAllBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  resultList: { flex: 1 },
  emptyText: { paddingHorizontal: 12, paddingVertical: 8, fontSize: 12 },
  filePath: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 2, fontSize: 11, fontWeight: '600' },
  matchRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 3, gap: 8 },
  lineNum: { fontSize: 11, width: 32, textAlign: 'right' },
  preview: { flex: 1, fontSize: 12, fontFamily: 'JetBrains Mono' },
});
