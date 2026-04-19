import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../theme/tokens';
import type { BlameLine } from '../../types/git';

export interface BlameDetailSheetProps {
  visible: boolean;
  blame: BlameLine | null;
  onClose: () => void;
  onViewDiff: (commitHash: string) => void;
}

export default function BlameDetailSheet({
  visible,
  blame,
  onClose,
  onViewDiff,
}: BlameDetailSheetProps): React.ReactElement {
  const t = useTheme();
  if (!visible || !blame) return <></>;

  const date = new Date(blame.timestamp).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  const s = styles(t);

  return (
    <Modal
      testID="blame-sheet"
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.hash}>{blame.commitHash}</Text>
            <TouchableOpacity
              testID="blame-sheet-close"
              onPress={onClose}
              accessibilityLabel="Close blame detail"
              style={s.closeBtn}
            >
              <Text style={s.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.message}>{blame.message}</Text>
          <View style={s.meta}>
            <Text style={s.author}>{blame.author}</Text>
            <Text style={s.date}>{date}</Text>
          </View>
          <TouchableOpacity
            testID="view-diff-btn"
            onPress={() => onViewDiff(blame.commitHash)}
            style={s.diffBtn}
            accessibilityLabel="View diff for this commit"
          >
            <Text style={s.diffBtnText}>▸ View Diff</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = (t: ReturnType<typeof import('../../theme/tokens').useTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1, justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: '#1e293b',
      borderTopLeftRadius: 14, borderTopRightRadius: 14,
      padding: 20, paddingBottom: 36,
    },
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 12,
    },
    hash: {
      color: t.accent, fontSize: 13,
      fontFamily: 'monospace', fontWeight: '600',
    },
    closeBtn: { padding: 4 },
    closeText: { color: t.text, fontSize: 18 },
    message: { color: t.text, fontSize: 15, fontWeight: '600', marginBottom: 8 },
    meta: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    author: { color: t.textMuted, fontSize: 13 },
    date: { color: t.textMuted, fontSize: 13 },
    diffBtn: { paddingVertical: 8 },
    diffBtnText: { color: t.accent, fontSize: 14 },
  });
