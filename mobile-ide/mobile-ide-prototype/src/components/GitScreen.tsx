import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import useGitStore from '../stores/useGitStore';
import { useTheme } from '../theme/tokens';
import BranchesTab from './git/BranchesTab';
import ConflictsTab from './git/ConflictsTab';
import StashTab from './git/StashTab';

export interface GitScreenProps {
  rootPath: string;
  authToken: string | null;
}

type Tab = 'branches' | 'conflicts' | 'stash';

export default function GitScreen({ rootPath, authToken }: GitScreenProps): React.ReactElement {
  const t = useTheme();
  const isOpen = useGitStore((s) => s.isGitScreenOpen);
  const activeTab = useGitStore((s) => s.activeGitTab);
  const conflicts = useGitStore((s) => s.conflicts);
  const setActiveTab = useGitStore((s) => s.setActiveGitTab);
  const setIsOpen = useGitStore((s) => s.setIsGitScreenOpen);

  if (!isOpen) return <></>;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'branches', label: 'Branches' },
    { id: 'conflicts', label: 'Conflicts' },
    { id: 'stash', label: 'Stash' },
  ];

  const s = styles(t);

  return (
    <Modal
      testID="git-screen-modal"
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setIsOpen(false)}
    >
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Git</Text>
          <TouchableOpacity
            testID="git-screen-close"
            onPress={() => setIsOpen(false)}
            accessibilityLabel="Close Git screen"
            style={s.closeBtn}
          >
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={s.tabBar}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              testID={`tab-${tab.id}`}
              onPress={() => setActiveTab(tab.id)}
              style={[s.tab, activeTab === tab.id && s.tabActive]}
              accessibilityLabel={tab.label}
            >
              <Text style={[s.tabText, activeTab === tab.id && s.tabTextActive]}>
                {tab.label}
              </Text>
              {tab.id === 'conflicts' && conflicts.length > 0 && (
                <View testID="conflicts-badge" style={s.badge}>
                  <Text style={s.badgeText}>{conflicts.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View style={s.content}>
          {activeTab === 'branches' && (
            <BranchesTab rootPath={rootPath} authToken={authToken} />
          )}
          {activeTab === 'conflicts' && (
            <ConflictsTab rootPath={rootPath} />
          )}
          {activeTab === 'stash' && (
            <StashTab rootPath={rootPath} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = (t: ReturnType<typeof import('../theme/tokens').useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    title: { color: t.text, fontSize: 17, fontWeight: '600' },
    closeBtn: { padding: 8 },
    closeText: { color: t.text, fontSize: 18 },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 6,
    },
    tabActive: { borderBottomWidth: 2, borderBottomColor: t.accent },
    tabText: { color: t.textMuted, fontSize: 14 },
    tabTextActive: { color: t.accent, fontWeight: '600' },
    badge: {
      backgroundColor: '#EF4444',
      borderRadius: 8,
      minWidth: 16,
      paddingHorizontal: 4,
      alignItems: 'center',
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    content: { flex: 1 },
  });
