import React, { useRef, useState } from 'react';
import {
  Clipboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { FileSystemBridge } from '../utils/FileSystemBridge';

interface TerminalProps {
  workingDirectory?: string;
  onCommand?: (command: string) => void;
  visible?: boolean;
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
export function Terminal({ workingDirectory = '/', onCommand, visible }: TerminalProps) {
  const [input, setInput] = useState('');
  const [cwd, setCwd] = useState(workingDirectory);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [lines, setLines] = useState<OutputLine[]>([
    { id: lineId++, text: 'NomadCode Terminal v0.1 (sandboxed)', type: 'output' },
    { id: lineId++, text: `Working directory: ${workingDirectory}`, type: 'output' },
    { id: lineId++, text: '', type: 'output' },
  ]);
  const scrollRef = useRef<ScrollView>(null);

  const addLine = (text: string, type: OutputLine['type'] = 'output') => {
    setLines(prev => [...prev, { id: lineId++, text, type }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const handleSubmit = async () => {
    const cmd = input.trim();
    setInput('');
    if (!cmd) return;

    setHistory(prev => [cmd, ...prev].slice(0, 50));
    setHistoryIdx(-1);

    addLine(`$ ${cmd}`, 'command');
    onCommand?.(cmd);

    const [base, ...args] = cmd.split(' ');

    switch (base) {
      case 'help':
        addLine('Available commands: help, clear, pwd, ls, cd, echo', 'output');
        break;
      case 'clear':
        setLines([]);
        break;
      case 'pwd':
        addLine(cwd, 'output');
        break;
      case 'ls': {
        try {
          const entries = await FileSystemBridge.listDirectory(cwd);
          if (entries.length === 0) {
            addLine('(empty)', 'output');
          } else {
            entries.forEach(e => addLine(e.isDirectory ? `${e.name}/` : e.name, 'output'));
          }
        } catch {
          addLine(`ls: cannot access '${cwd}': Permission denied`, 'error');
        }
        break;
      }
      case 'cd': {
        const target = args[0];
        if (!target) {
          addLine('cd: missing argument', 'error');
        } else {
          const next = target.startsWith('/')
            ? target
            : `${cwd}/${target}`.replace(/\/+/g, '/');
          setCwd(next);
        }
        break;
      }
      case 'echo':
        addLine(args.join(' '), 'output');
        break;
      default:
        addLine(`bash: ${base}: command not found`, 'error');
    }
  };

  const handleHistoryUp = () => {
    const next = Math.min(historyIdx + 1, history.length - 1);
    setHistoryIdx(next);
    setInput(history[next] ?? '');
  };

  const handleHistoryDown = () => {
    const next = historyIdx - 1;
    if (next < 0) {
      setHistoryIdx(-1);
      setInput('');
    } else {
      setHistoryIdx(next);
      setInput(history[next]);
    }
  };

  return (
    <View
      testID="terminal-container"
      style={[styles.container, visible === false && { display: 'none' }]}
    >
    <KeyboardAvoidingView
      style={styles.innerContainer}
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
          <TouchableOpacity
            key={line.id}
            onLongPress={() => Clipboard.setString(line.text)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.line,
                line.type === 'command' && styles.commandLine,
                line.type === 'error' && styles.errorLine,
              ]}
            >
              {line.text}
            </Text>
          </TouchableOpacity>
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
        <TouchableOpacity testID="history-up" onPress={handleHistoryUp} style={styles.histBtn}>
          <Text style={styles.histBtnText}>↑</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="history-down" onPress={handleHistoryDown} style={styles.histBtn}>
          <Text style={styles.histBtnText}>↓</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  innerContainer: {
    flex: 1,
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
  histBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  histBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontFamily: 'monospace',
  },
});
