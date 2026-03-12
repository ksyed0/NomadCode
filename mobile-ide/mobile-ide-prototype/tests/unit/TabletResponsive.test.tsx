/**
 * Unit tests — TabletResponsive layout + useIsTablet hook
 *
 * useWindowDimensions is mocked to simulate tablet (width > 768) and
 * phone (width ≤ 768) screens without a real device.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PanResponder, Text } from 'react-native';
import TabletResponsive, { clampTerminalHeight, isDownwardSwipe, useIsTablet } from '../../src/layout/TabletResponsive';
import { renderHook } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock useWindowDimensions
// ---------------------------------------------------------------------------

const mockDimensions = { width: 1024, height: 768 };

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => mockDimensions,
}));

// Helper to change the simulated screen width between tests
function setWidth(width: number) {
  mockDimensions.width = width;
}

// ---------------------------------------------------------------------------
// Test content nodes
// ---------------------------------------------------------------------------

const Sidebar  = () => <Text testID="sidebar">Sidebar</Text>;
const Main     = () => <Text testID="main">Main</Text>;
const Terminal = () => <Text testID="terminal">Terminal</Text>;

// ---------------------------------------------------------------------------
// useIsTablet hook
// ---------------------------------------------------------------------------

describe('useIsTablet', () => {
  it('returns true when width > 768', () => {
    setWidth(1024);
    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(true);
  });

  it('returns false when width === 768', () => {
    setWidth(768);
    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(false);
  });

  it('returns false when width < 768', () => {
    setWidth(375);
    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(false);
  });

  it('returns true at exactly 769', () => {
    setWidth(769);
    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tablet layout (width > 768)
// ---------------------------------------------------------------------------

describe('TabletResponsive — tablet layout', () => {
  beforeEach(() => setWidth(1024));

  it('renders sidebar, main, and terminal', () => {
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={<Terminal />} />,
    );
    expect(screen.getByTestId('sidebar')).toBeTruthy();
    expect(screen.getByTestId('main')).toBeTruthy();
    expect(screen.getByTestId('terminal')).toBeTruthy();
  });

  it('renders without terminal when terminal prop is null', () => {
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />,
    );
    expect(screen.queryByTestId('terminal')).toBeNull();
    expect(screen.getByTestId('sidebar')).toBeTruthy();
    expect(screen.getByTestId('main')).toBeTruthy();
  });

  it('does not show the phone sidebar toggle button', () => {
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />,
    );
    // Toggle button shows ☰ icon — should be absent on tablet
    expect(screen.queryByText('☰')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Phone layout (width ≤ 768)
// ---------------------------------------------------------------------------

describe('TabletResponsive — phone layout', () => {
  beforeEach(() => setWidth(375));

  it('renders main content', () => {
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />,
    );
    expect(screen.getByTestId('main')).toBeTruthy();
  });

  it('shows the hamburger sidebar toggle button', () => {
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />,
    );
    expect(screen.getByText('☰')).toBeTruthy();
  });

  it('sidebar is hidden by default on phone', () => {
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />,
    );
    expect(screen.queryByTestId('sidebar')).toBeNull();
  });

  it('shows sidebar drawer when toggle is pressed', () => {
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />,
    );
    fireEvent.press(screen.getByText('☰'));
    expect(screen.getByTestId('sidebar')).toBeTruthy();
  });

  it('changes toggle icon from ☰ to ✕ when drawer opens', () => {
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />,
    );
    fireEvent.press(screen.getByText('☰'));
    expect(screen.getByText('✕')).toBeTruthy();
    expect(screen.queryByText('☰')).toBeNull();
  });

  it('closes drawer and shows ☰ again when ✕ is pressed', () => {
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />,
    );
    fireEvent.press(screen.getByText('☰'));
    fireEvent.press(screen.getByText('✕'));
    expect(screen.getByText('☰')).toBeTruthy();
    expect(screen.queryByTestId('sidebar')).toBeNull();
  });

  it('closes drawer when the scrim (backdrop) is tapped', () => {
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />,
    );
    fireEvent.press(screen.getByText('☰'));
    expect(screen.getByTestId('sidebar')).toBeTruthy();
    fireEvent.press(screen.getByTestId('sidebar-scrim'));
    expect(screen.queryByTestId('sidebar')).toBeNull();
  });

  it('renders terminal strip when terminal prop is provided', () => {
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={<Terminal />} />,
    );
    expect(screen.getByTestId('terminal')).toBeTruthy();
  });

  it('does not render terminal when terminal prop is null', () => {
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />,
    );
    expect(screen.queryByTestId('terminal')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Custom dimensions
// ---------------------------------------------------------------------------

describe('TabletResponsive — custom dimensions', () => {
  it('accepts custom sidebarWidth prop without crashing', () => {
    setWidth(1024);
    expect(() =>
      render(
        <TabletResponsive
          sidebar={<Sidebar />}
          main={<Main />}
          terminal={null}
          sidebarWidth={320}
        />,
      ),
    ).not.toThrow();
  });

  it('accepts custom terminalHeight prop without crashing', () => {
    setWidth(1024);
    expect(() =>
      render(
        <TabletResponsive
          sidebar={<Sidebar />}
          main={<Main />}
          terminal={<Terminal />}
          terminalHeight={300}
        />,
      ),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Resize handle
// ---------------------------------------------------------------------------

describe('TabletResponsive — terminal resize handle', () => {
  beforeEach(() => setWidth(1024));

  it('renders terminal-resize-handle when terminal is provided', () => {
    render(
      <TabletResponsive
        sidebar={<Sidebar />}
        main={<Main />}
        terminal={<Terminal />}
        terminalHeight={220}
        onTerminalHeightChange={jest.fn()}
      />
    );
    expect(screen.getByTestId('terminal-resize-handle')).toBeTruthy();
  });

  it('does not render resize handle when terminal is null', () => {
    render(
      <TabletResponsive
        sidebar={<Sidebar />}
        main={<Main />}
        terminal={null}
      />
    );
    expect(screen.queryByTestId('terminal-resize-handle')).toBeNull();
  });

  it('calls onTerminalHeightChange when PanResponder move fires', () => {
    // Capture the PanResponder callbacks so we can invoke them directly in tests
    // (raw responder event firing crashes due to internal touchHistory math)
    let capturedCallbacks: Record<string, (...args: unknown[]) => unknown> = {};
    const spy = jest
      .spyOn(PanResponder, 'create')
      .mockImplementation((cbs) => {
        capturedCallbacks = cbs as unknown as Record<string, (...args: unknown[]) => unknown>;
        return { panHandlers: {} } as ReturnType<typeof PanResponder.create>;
      });

    const onHeightChange = jest.fn();
    render(
      <TabletResponsive
        sidebar={<Sidebar />}
        main={<Main />}
        terminal={<Terminal />}
        terminalHeight={220}
        onTerminalHeightChange={onHeightChange}
      />
    );

    // Cover onStartShouldSetPanResponder
    expect(capturedCallbacks.onStartShouldSetPanResponder()).toBe(true);
    // Cover onPanResponderMove — dragging down 30px → 220-30=190
    capturedCallbacks.onPanResponderMove({}, { dy: 30 });
    expect(onHeightChange).toHaveBeenCalledWith(190);

    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// clampTerminalHeight utility
// ---------------------------------------------------------------------------

describe('clampTerminalHeight', () => {
  it('reduces height when dragging down (positive dy)', () => {
    expect(clampTerminalHeight(220, 50)).toBe(170);
  });

  it('increases height when dragging up (negative dy)', () => {
    expect(clampTerminalHeight(220, -50)).toBe(270);
  });

  it('clamps to MIN_TERMINAL_HEIGHT (120) when dragging too far down', () => {
    expect(clampTerminalHeight(220, 200)).toBe(120);
  });

  it('clamps to MAX_TERMINAL_HEIGHT (400) when dragging too far up', () => {
    expect(clampTerminalHeight(220, -300)).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// isDownwardSwipe utility
// ---------------------------------------------------------------------------

describe('isDownwardSwipe', () => {
  it('returns true when dy > 40 and vy > 0.3', () => {
    expect(isDownwardSwipe(50, 0.4)).toBe(true);
  });

  it('returns false when dy is exactly 40 (not strictly greater)', () => {
    expect(isDownwardSwipe(40, 0.4)).toBe(false);
  });

  it('returns false when vy is exactly 0.3 (not strictly greater)', () => {
    expect(isDownwardSwipe(50, 0.3)).toBe(false);
  });

  it('returns false when dy is below threshold', () => {
    expect(isDownwardSwipe(30, 0.4)).toBe(false);
  });

  it('returns false when vy is below threshold', () => {
    expect(isDownwardSwipe(50, 0.2)).toBe(false);
  });

  it('returns true at minimum passing values (dy=41, vy=0.31)', () => {
    expect(isDownwardSwipe(41, 0.31)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Swipe gesture zone
// ---------------------------------------------------------------------------

describe('TabletResponsive — swipe gesture zone', () => {
  beforeEach(() => setWidth(1024));

  // Shared spy state for PanResponder tests
  let capturedSwipeCbs: Record<string, (...args: unknown[]) => unknown> = {};
  let swipeSpy: jest.SpyInstance | null = null;

  function installSwipeSpy() {
    capturedSwipeCbs = {};
    let callIdx = 0;
    swipeSpy = jest.spyOn(PanResponder, 'create').mockImplementation((cbs) => {
      // First call = terminal resize PanResponder; second call = swipe zone
      if (callIdx++ === 1) {
        capturedSwipeCbs = cbs as unknown as Record<string, (...args: unknown[]) => unknown>;
      }
      return { panHandlers: {} } as ReturnType<typeof PanResponder.create>;
    });
  }

  afterEach(() => {
    swipeSpy?.mockRestore();
    swipeSpy = null;
  });

  it('renders swipe-zone testID in main area (tablet)', () => {
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />,
    );
    expect(screen.getByTestId('swipe-zone')).toBeTruthy();
  });

  it('renders swipe-zone on phone layout too', () => {
    setWidth(375);
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />,
    );
    expect(screen.getByTestId('swipe-zone')).toBeTruthy();
  });

  it('calls onOpenPalette when swipe-down gesture is released', () => {
    installSwipeSpy();
    const onOpenPalette = jest.fn();
    render(
      <TabletResponsive
        sidebar={<Sidebar />}
        main={<Main />}
        terminal={<Terminal />}
        onOpenPalette={onOpenPalette}
      />,
    );

    expect(capturedSwipeCbs.onStartShouldSetPanResponder?.()).toBe(true);
    capturedSwipeCbs.onPanResponderRelease?.({}, { dy: 50, vy: 0.4 });
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });

  it('does not call onOpenPalette for swipes below threshold', () => {
    installSwipeSpy();
    const onOpenPalette = jest.fn();
    render(
      <TabletResponsive
        sidebar={<Sidebar />}
        main={<Main />}
        terminal={<Terminal />}
        onOpenPalette={onOpenPalette}
      />,
    );

    capturedSwipeCbs.onPanResponderRelease?.({}, { dy: 30, vy: 0.4 }); // dy too small
    capturedSwipeCbs.onPanResponderRelease?.({}, { dy: 50, vy: 0.2 }); // vy too small
    expect(onOpenPalette).toHaveBeenCalledTimes(0);
  });

  it('does not crash when onOpenPalette is not provided', () => {
    installSwipeSpy();
    render(
      <TabletResponsive
        sidebar={<Sidebar />}
        main={<Main />}
        terminal={<Terminal />}
      />,
    );
    expect(() =>
      capturedSwipeCbs.onPanResponderRelease?.({}, { dy: 50, vy: 0.4 }),
    ).not.toThrow();
  });
});
