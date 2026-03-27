/**
 * WorkspaceConflictModal — shown when the OS cloud sync has changed a file that
 * the user also has open and modified in the editor.
 *
 * The modal is intentionally stateless: App.tsx owns the detected ConflictInfo
 * and calls onResolve() with the user's chosen ConflictResolution.
 *
 * Resolution options:
 *   keep-mine  — discard cloud changes, keep editor content as-is
 *   use-cloud  — discard in-editor changes, reload content from disk
 *   keep-both  — save current editor content to a new "<name>.conflict.<ext>" file,
 *                then reload the cloud version into the original tab
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { ConflictInfo, ConflictResolution } from '../types/workspace';
import { useTheme } from '../theme/tokens';

export interface WorkspaceConflictModalProps {
  conflict: ConflictInfo | null;
  onResolve: (resolution: ConflictResolution) => void;
}

export default function WorkspaceConflictModal({ conflict, onResolve }: WorkspaceConflictModalProps) {
  const tokens = useTheme();

  if (!conflict) return null;

  return (
    <Modal
      visible={true}
      animationType="fade"
      transparent={true}
      onRequestClose={() => onResolve('keep-mine')}
    >
      <View style={styles.backdrop}>
        <View testID="conflict-modal" style={[styles.card, { backgroundColor: tokens.bgElevated, borderColor: tokens.border }]}>

          <Text style={[styles.title, { color: tokens.text }]}>File Changed on Cloud</Text>

          <Text style={[styles.body, { color: tokens.textMuted }]}>
            <Text style={{ color: tokens.text, fontWeight: '600' }}>{conflict.fileName}</Text>
            {' '}was updated by cloud sync while you have unsaved changes.
          </Text>

          <TouchableOpacity
            testID="btn-keep-mine"
            style={[styles.btn, { backgroundColor: tokens.accent }]}
            onPress={() => onResolve('keep-mine')}
            accessibilityRole="button"
            accessibilityLabel="Keep my changes"
          >
            <Text style={styles.btnText}>Keep My Changes</Text>
            <Text style={[styles.btnSubtext, { color: 'rgba(255,255,255,0.75)' }]}>Discard cloud update</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="btn-use-cloud"
            style={[styles.btn, { backgroundColor: tokens.bgElevated, borderWidth: 1, borderColor: tokens.border }]}
            onPress={() => onResolve('use-cloud')}
            accessibilityRole="button"
            accessibilityLabel="Use cloud version"
          >
            <Text style={[styles.btnText, { color: tokens.text }]}>Use Cloud Version</Text>
            <Text style={[styles.btnSubtext, { color: tokens.textMuted }]}>Discard my unsaved changes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="btn-keep-both"
            style={[styles.btn, { backgroundColor: tokens.bgElevated, borderWidth: 1, borderColor: tokens.border }]}
            onPress={() => onResolve('keep-both')}
            accessibilityRole="button"
            accessibilityLabel="Keep both versions"
          >
            <Text style={[styles.btnText, { color: tokens.text }]}>Keep Both</Text>
            <Text style={[styles.btnSubtext, { color: tokens.textMuted }]}>Save mine as a .conflict file</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    minHeight: 44,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  btnSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
});
