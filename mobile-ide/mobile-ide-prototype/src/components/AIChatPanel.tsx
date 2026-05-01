// src/components/AIChatPanel.tsx
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTheme } from '../theme/tokens';
import useAIStore from '../stores/useAIStore';
import type { ChatMessage } from '../ai/aiProvider';

interface AIChatPanelProps {
  activeFilePath: string | null;
  activeFileContent: string;
  activeFileLanguage: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  claude: '✦ Claude',
  gemini: '◈ Gemini',
  kimi:   '◉ Kimi',
  custom: '⚙ Custom',
};

function filename(path: string | null): string {
  if (!path) return 'no file open';
  return path.split('/').pop() ?? path;
}

export default function AIChatPanel({ activeFilePath, activeFileContent, activeFileLanguage }: AIChatPanelProps) {
  const t = useTheme();
  const storeState = useAIStore();
  const { messages, isStreaming, streamingText, dailySpendCents, selectedProviderId,
          sendMessage, cancelStream, clearHistory } = storeState;

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isStreaming) return;
    const text = inputText.trim();
    setInputText('');
    await sendMessage(text, activeFileContent, activeFileLanguage);
  }, [inputText, isStreaming, sendMessage, activeFileContent, activeFileLanguage]);

  const spendLabel = selectedProviderId === 'custom'
    ? 'custom'
    : `${dailySpendCents.toFixed(1)}¢`;

  const allMessages: ChatMessage[] = [
    ...messages,
    ...(streamingText ? [{ role: 'assistant' as const, content: streamingText }] : []),
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: t.border, backgroundColor: t.bgElevated }]}>
        <View>
          <Text style={[styles.headerTitle, { color: t.text }]}>AI Chat</Text>
          <Text style={[styles.headerSub, { color: t.textMuted }]}>
            Context: {filename(activeFilePath)}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {isStreaming ? (
            <TouchableOpacity
              onPress={cancelStream}
              style={[styles.stopBtn, { backgroundColor: t.bgHighlight }]}
            >
              <Text style={[styles.stopBtnText, { color: t.error }]}>■ Stop</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.spendChip, { color: t.textMuted, backgroundColor: t.bgHighlight }]}>
              {spendLabel}
            </Text>
          )}
          <TouchableOpacity
            onPress={clearHistory}
            accessibilityLabel="Clear chat history"
            style={styles.clearBtn}
          >
            <Text style={[styles.clearBtnText, { color: t.textMuted }]}>⌫</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={allMessages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={item.role === 'user' ? styles.userBubbleWrap : styles.assistantBubbleWrap}>
            {item.role === 'assistant' && (
              <Text style={[styles.providerLabel, { color: t.accent }]}>
                {PROVIDER_LABELS[selectedProviderId] ?? '✦ AI'}
              </Text>
            )}
            <View style={[
              styles.bubble,
              item.role === 'user'
                ? [styles.userBubble, { backgroundColor: '#1E3A5F' }]
                : [styles.assistantBubble, { backgroundColor: t.bgElevated }],
            ]}>
              <Text style={[styles.bubbleText, { color: t.text }]}>{item.content}</Text>
            </View>
          </View>
        )}
      />

      {/* Input */}
      <View style={[styles.inputRow, { borderTopColor: t.border, backgroundColor: t.bgElevated }]}>
        <TextInput
          style={[styles.input, { backgroundColor: t.bg, borderColor: t.border, color: t.text }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={`Ask about ${filename(activeFilePath)}…`}
          placeholderTextColor={t.textMuted}
          multiline
          editable={!isStreaming}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={isStreaming || !inputText.trim()}
          accessibilityHint="Send message"
          accessibilityState={{ disabled: isStreaming || !inputText.trim() }}
          style={[styles.sendBtn, { backgroundColor: isStreaming ? t.bgHighlight : t.accent }]}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1 },
  header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1 },
  headerTitle:         { fontSize: 13, fontWeight: '700' },
  headerSub:           { fontSize: 11, marginTop: 1 },
  headerActions:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spendChip:           { fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  stopBtn:             { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  stopBtnText:         { fontSize: 12, fontWeight: '600' },
  clearBtn:            { padding: 4, minWidth: 32, alignItems: 'center' },
  clearBtnText:        { fontSize: 16 },
  messageList:         { padding: 10, gap: 10, flexGrow: 1 },
  userBubbleWrap:      { alignItems: 'flex-end' },
  assistantBubbleWrap: { alignItems: 'flex-start' },
  providerLabel:       { fontSize: 10, fontWeight: '700', marginBottom: 3, marginLeft: 2 },
  bubble:              { borderRadius: 10, padding: 9, maxWidth: '88%' },
  userBubble:          { borderBottomRightRadius: 2 },
  assistantBubble:     { borderBottomLeftRadius: 2 },
  bubbleText:          { fontSize: 13, lineHeight: 20 },
  inputRow:            { flexDirection: 'row', gap: 8, padding: 8, borderTopWidth: 1 },
  input:               { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, maxHeight: 100 },
  sendBtn:             { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sendBtnText:         { color: 'white', fontSize: 18, fontWeight: '700' },
});
