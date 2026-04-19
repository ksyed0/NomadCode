/**
 * TabletResponsive — adaptive three-pane IDE layout.
 *
 * Tablet  (width ≥ 768):  [Sidebar | Editor ] + [Terminal bottom strip]
 * Phone   (width < 768):  [Editor] with collapsible sidebar drawer + bottom terminal
 *
 * The sidebar width and terminal height are configurable via props.
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { useTheme } from '../theme/tokens';

// ---------------------------------------------------------------------------
// Breakpoints and defaults
// ---------------------------------------------------------------------------

const TABLET_BREAKPOINT = 768;
const SIDEBAR_WIDTH = 260;
const TERMINAL_HEIGHT = 220;

// ---------------------------------------------------------------------------
// Hook — exported for use in components that need layout info
// ---------------------------------------------------------------------------

export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= TABLET_BREAKPOINT;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TabletResponsiveProps {
  /** File explorer / project tree panel */
  sidebar: React.ReactNode;
  /** Primary editor area */
  main: React.ReactNode;
  /** Terminal / output panel; pass null to hide */
  terminal: React.ReactNode | null;
  /** Override sidebar width (default 260) */
  sidebarWidth?: number;
  /** Override terminal height (default 220) */
  terminalHeight?: number;
  /** Called when user drags the resize handle */
  onTerminalHeightChange?: (height: number) => void;
  /** Called when user swipes down on the main editor area to open command palette */
  onOpenPalette?: () => void;
  /** Called when user presses the gear icon to open settings */
  onOpenSettings?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MIN_TERMINAL_HEIGHT = 120;
const MAX_TERMINAL_HEIGHT = 400;

/** Exported for unit-testing the resize-drag arithmetic. */
export function clampTerminalHeight(current: number, dy: number): number {
  return Math.max(MIN_TERMINAL_HEIGHT, Math.min(MAX_TERMINAL_HEIGHT, current - dy));
}

/** Exported for unit-testing the swipe-to-open predicate. */
export function isDownwardSwipe(dy: number, vy: number): boolean {
  return dy > 40 && vy > 0.3;
}

export default function TabletResponsive({
  sidebar,
  main,
  terminal,
  sidebarWidth = SIDEBAR_WIDTH,
  terminalHeight = TERMINAL_HEIGHT,
  onTerminalHeightChange,
  onOpenPalette,
  onOpenSettings,
}: TabletResponsiveProps) {
  const t = useTheme();
  const isTablet = useIsTablet();
  const [phoneSidebarOpen, setPhoneSidebarOpen] = useState(false);

  const showTerminal = terminal !== null;

  // NOTE: PanResponder callbacks close over props at mount time.
  // Callers must pass stable callback references (e.g. via useCallback)
  // to avoid stale-closure issues on re-render.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        onTerminalHeightChange?.(clampTerminalHeight(terminalHeight, gs.dy));
      },
    }),
  );

  // NOTE: Same stale-closure caveat as panResponder above.
  const swipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, gs) => {
        if (isDownwardSwipe(gs.dy, gs.vy)) {
          onOpenPalette?.();
        }
      },
    }),
  );

  // Shared gesture zone — placed at the top of the main editor area in both layouts.
  // Captures downward swipes to open the command palette.
  const swipeZoneView = (
    <View
      testID="swipe-zone"
      style={styles.swipeZone}
      // eslint-disable-next-line react-hooks/refs
      {...swipePanResponder.current.panHandlers}
    />
  );

  // Gear icon button — opens settings (rendered in a footer strip at the bottom of the sidebar)
  const gearButton = (
    <TouchableOpacity
      testID="settings-gear"
      onPress={() => onOpenSettings?.()}
      style={[styles.gearBtn, { borderTopColor: t.border }]}
      accessibilityLabel="Open settings"
      accessibilityRole="button"
    >
      <Text style={[styles.gearIcon, { color: t.textMuted }]}>⚙</Text>
      <Text style={[styles.gearLabel, { color: t.textMuted }]}>Settings</Text>
    </TouchableOpacity>
  );

  // ── SINGLE RETURN — terminal always at root→child[1]→child[1] ──────────────
  // Both tablet and phone modes render the same tree shape. Only styles change
  // on fold/unfold, so React reconciles (updates) rather than remounting the
  // terminal WebView. This preserves the active WASM terminal session (AC-0185).
  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      {/* child[0] — content area; type is always View, style changes only */}
      <View style={isTablet ? styles.row : styles.phoneMainArea}>
        {isTablet && (
          <View style={[styles.sidebar, { width: sidebarWidth, backgroundColor: t.bgElevated, borderRightColor: t.border }]}>
            <View style={styles.sidebarContent}>
              {sidebar}
            </View>
            {gearButton}
          </View>
        )}
        <View style={styles.mainArea}>
          {swipeZoneView}
          {main}
        </View>
      </View>

      {/* child[1] — terminal strip; always a View at the same tree position.
          This guarantees React reconciles on layout switch instead of remounting. */}
      {showTerminal && (
        <View
          style={[
            isTablet ? styles.terminalStrip : styles.phoneTerminal,
            { height: terminalHeight, borderTopColor: t.border, backgroundColor: t.bg },
          ]}
        >
          {/* Resize handle: present in tree on both modes so terminal stays at
              child[1]. Hidden via display:none on phone — no visual impact. */}
          <View
            testID="terminal-resize-handle"
            style={[
              styles.resizeHandle,
              { backgroundColor: t.bgElevated, borderTopColor: t.border },
              !isTablet && styles.hidden,
            ]}
            // eslint-disable-next-line react-hooks/refs
            {...panResponder.current.panHandlers}
          />
          {/* terminal is always child[1] here — stable position → no remount */}
          {terminal}
        </View>
      )}

      {/* children[2+] — phone-only sidebar toggle + drawer overlay */}
      {!isTablet && (
        <>
          <TouchableOpacity
            style={[styles.phoneSidebarToggle, { backgroundColor: t.accent }]}
            onPress={() => setPhoneSidebarOpen((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.phoneSidebarToggleIcon}>{phoneSidebarOpen ? '✕' : '☰'}</Text>
          </TouchableOpacity>

          {phoneSidebarOpen && (
            <>
              {/* Scrim — tap to close */}
              <TouchableOpacity
                testID="sidebar-scrim"
                style={styles.scrim}
                activeOpacity={1}
                onPress={() => setPhoneSidebarOpen(false)}
              />
              {/* Drawer panel */}
              <Animated.View style={[styles.phoneSidebar, { width: sidebarWidth, backgroundColor: t.bgElevated, borderRightColor: t.border }]}>
                <View style={styles.sidebarContent}>
                  {sidebar}
                </View>
                {gearButton}
              </Animated.View>
            </>
          )}
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles (non-color values only — colors come from theme tokens via inline styles)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Tablet
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    borderRightWidth: StyleSheet.hairlineWidth,
    flexDirection: 'column',
  },
  sidebarContent: {
    flex: 1,
  },
  mainArea: {
    flex: 1,
  },
  swipeZone: {
    height: 8,
    width: '100%',
    backgroundColor: 'transparent',
  },
  resizeHandle: {
    height: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminalStrip: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Phone
  phoneMainArea: {
    flex: 1,
  },
  phoneTerminal: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  phoneSidebarToggle: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  phoneSidebarToggleIcon: {
    color: '#FFF',
    fontSize: 18,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000066',
    zIndex: 10,
  },
  phoneSidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 11,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  gearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  gearIcon: { fontSize: 15 },
  gearLabel: { fontSize: 12, fontWeight: '500' },
  // Hides the resize handle in phone mode while keeping it in the React tree,
  // so terminal stays at a stable child index regardless of layout mode.
  hidden: { display: 'none' },
});
