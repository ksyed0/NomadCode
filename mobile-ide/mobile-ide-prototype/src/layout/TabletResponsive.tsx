/**
 * TabletResponsive — adaptive three-pane IDE layout.
 *
 * Tablet  (width > 768):  [Sidebar | Editor ] + [Terminal bottom strip]
 * Phone   (width ≤ 768):  [Editor] with collapsible sidebar drawer + bottom terminal
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
  return width > TABLET_BREAKPOINT;
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
}: TabletResponsiveProps) {
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
  ).current;

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
  ).current;

  // Shared gesture zone — placed at the top of the main editor area in both layouts.
  // Captures downward swipes to open the command palette.
  const swipeZoneView = (
    <View
      testID="swipe-zone"
      style={styles.swipeZone}
      {...swipePanResponder.panHandlers}
    />
  );

  // ── Tablet layout ──────────────────────────────────────────────────────────
  if (isTablet) {
    return (
      <View style={styles.root}>
        {/* Main row: sidebar + editor */}
        <View style={styles.row}>
          <View style={[styles.sidebar, { width: sidebarWidth }]}>{sidebar}</View>
          <View style={styles.mainArea}>
            {swipeZoneView}
            {main}
          </View>
        </View>

        {/* Terminal strip at bottom */}
        {showTerminal && (
          <>
            <View
              testID="terminal-resize-handle"
              style={styles.resizeHandle}
              {...panResponder.panHandlers}
            />
            <View style={[styles.terminalStrip, { height: terminalHeight }]}>
              {terminal}
            </View>
          </>
        )}
      </View>
    );
  }

  // ── Phone layout ───────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Editor fills the top area */}
      <View style={styles.phoneMainArea}>
        {swipeZoneView}
        {main}
      </View>

      {/* Terminal slides up from the bottom */}
      {showTerminal && (
        <View style={[styles.phoneTerminal, { height: terminalHeight }]}>
          {terminal}
        </View>
      )}

      {/* Floating sidebar toggle button (bottom-left) */}
      <TouchableOpacity
        style={styles.phoneSidebarToggle}
        onPress={() => setPhoneSidebarOpen((v) => !v)}
        activeOpacity={0.8}
      >
        <Text style={styles.phoneSidebarToggleIcon}>{phoneSidebarOpen ? '✕' : '☰'}</Text>
      </TouchableOpacity>

      {/* Sidebar drawer overlay */}
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
          <Animated.View style={[styles.phoneSidebar, { width: sidebarWidth }]}>
            {sidebar}
          </Animated.View>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  // Tablet
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    backgroundColor: '#1E293B',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#334155',
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
    backgroundColor: '#1E293B',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminalStrip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#334155',
    backgroundColor: '#0D1117',
  },
  // Phone
  phoneMainArea: {
    flex: 1,
  },
  phoneTerminal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#334155',
    backgroundColor: '#0D1117',
  },
  phoneSidebarToggle: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
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
    backgroundColor: '#1E293B',
    zIndex: 11,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#334155',
  },
});
