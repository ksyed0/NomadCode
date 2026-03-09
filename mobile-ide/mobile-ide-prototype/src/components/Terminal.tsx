import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

interface TerminalProps {
  workingDirectory?: string;
  onCommand?: (command: string) => void;
}

interface OutputLine {
  id: number;
  text: string;
  type: 'output' | 'command' | 'error';
}

let lineId = 0;

/**
 * Terminal — sandboxed interactive terminal.
 *
 * NOTE: This is a prototype stub rendering a mock terminal UI.
 * In the full implementation, this connects to a WASI sandbox runtime
 * via a message-passing API.
 */
export function Terminal({ workingDirectory = '/', onCommand }: TerminalProps) {
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<OutputLine[]>([
    { id: lineId++, text: 'NomadCode Terminal v0.1 (sandboxed)', type: 'output' },
    { id: lineId++, text: `Working directory: ${workingDirectory}`, type: 'output' },
    { id: lineId++, text: '', type: 'output' },
  ]);
  const scrollRef = useRef<ScrollView>(null);

  const appendLine = useCallback((text: string, type: OutputLine['type'] = 'output') => {
    setLines((prev) => [...prev, { id: lineId++, text, type }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  const handleSubmit = useCallback(() => {
    const cmd = input.trim();
    if (!cmd) return;

    appendLine(`$ ${cmd}`, 'command');
    setInput('');
    onCommand?.(cmd);

    // Stub command responses
    switch (cmd) {
      case 'help':
        appendLine('Available commands: help, clear, pwd, ls, echo <text>');
        break;
      case 'clear':
        setLines([]);
        break;
      case 'pwd':
        appendLine(workingDirectory);
        break;
      case 'ls':
        appendLine('(sandbox) Directory listing not available in prototype.');
        break;
      default:
        if (cmd.startsWith('echo ')) {
          appendLine(cmd.slice(5));
        } else {
          appendLine(`bash: ${cmd}: command not found`, 'error');
        }
    }
  }, [input, appendLine, onCommand, workingDirectory]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>TERMINAL</Text>
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.output}
        contentContainerStyle={styles.outputContent}
      >
        {lines.map((line) => (
          <Text
            key={line.id}
            style={[
              styles.line,
              line.type === 'command' && styles.commandLine,
              line.type === 'error' && styles.errorLine,
            ]}
          >
            {line.text}
          </Text>
        ))}
      </ScrollView>
      <View style={styles.inputRow}>
        <Text style={styles.prompt}>$</Text>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Enter command..."
          placeholderTextColor="#475569"
          blurOnSubmit={false}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    backgroundColor: '#1E293B',
  },
  headerText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  output: {
    flex: 1,
  },
  outputContent: {
    padding: 12,
  },
  line: {
    color: '#CBD5E1',
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  commandLine: {
    color: '#22C55E',
  },
  errorLine: {
    color: '#EF4444',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  prompt: {
    color: '#22C55E',
    fontFamily: 'monospace',
    fontSize: 14,
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 13,
    fontFamily: 'monospace',
  },
});
