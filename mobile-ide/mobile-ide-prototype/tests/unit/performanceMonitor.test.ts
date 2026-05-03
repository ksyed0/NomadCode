import { AppState } from 'react-native';
import { startMemorySampling } from '../../src/observability/performanceMonitor';
import * as sentryService from '../../src/observability/sentryService';

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('../../src/observability/sentryService', () => ({
  captureError: jest.fn(),
  setContext:   jest.fn(),
}));

function setMemory(usedMb: number) {
  (global as unknown as { performance: { memory: { usedJSHeapSize: number } } })
    .performance = { memory: { usedJSHeapSize: usedMb * 1_048_576 } };
}

function clearMemory() {
  (global as unknown as { performance?: unknown }).performance = undefined;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  setMemory(30); // default: below threshold
});

afterEach(() => {
  jest.useRealTimers();
  clearMemory();
});

describe('startMemorySampling()', () => {
  it('returns a cleanup function', () => {
    const stop = startMemorySampling();
    expect(typeof stop).toBe('function');
    stop();
  });

  it('calls setContext on each interval tick', () => {
    startMemorySampling(60, 30_000);
    jest.advanceTimersByTime(30_000);
    expect(sentryService.setContext).toHaveBeenCalledWith(
      'memory',
      expect.objectContaining({ usedMb: expect.any(Number), thresholdMb: 60 })
    );
  });

  it('fires captureError when heap exceeds threshold', () => {
    setMemory(75); // above 60MB threshold
    startMemorySampling(60, 30_000);
    jest.advanceTimersByTime(30_000);
    expect(sentryService.captureError).toHaveBeenCalledTimes(1);
    expect(sentryService.captureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ usedMb: expect.any(Number), thresholdMb: 60 })
    );
  });

  it('does NOT fire captureError when heap is below threshold', () => {
    setMemory(30); // below 60MB
    startMemorySampling(60, 30_000);
    jest.advanceTimersByTime(30_000);
    expect(sentryService.captureError).not.toHaveBeenCalled();
  });

  it('rate-limits alerts — does not fire twice within 5 minutes', () => {
    setMemory(75);
    startMemorySampling(60, 30_000);
    jest.advanceTimersByTime(30_000);   // first tick — fires
    jest.advanceTimersByTime(30_000);   // second tick — within 5 min, should NOT fire again
    expect(sentryService.captureError).toHaveBeenCalledTimes(1);
  });

  it('fires again after 5-minute cooldown', () => {
    setMemory(75);
    startMemorySampling(60, 30_000);
    jest.advanceTimersByTime(30_000);              // fires once
    jest.advanceTimersByTime(5 * 60 * 1_000 + 1); // cooldown elapsed
    jest.advanceTimersByTime(30_000);              // fires again
    expect(sentryService.captureError).toHaveBeenCalledTimes(2);
  });

  it('cleanup function clears the interval', () => {
    const stop = startMemorySampling(60, 30_000);
    stop();
    jest.advanceTimersByTime(60_000);
    expect(sentryService.setContext).not.toHaveBeenCalled();
  });

  it('returns no-op cleanup when performance.memory is unavailable', () => {
    clearMemory();
    const stop = startMemorySampling();
    expect(typeof stop).toBe('function');
    expect(() => {
      jest.advanceTimersByTime(30_000);
      stop();
    }).not.toThrow();
    expect(sentryService.setContext).not.toHaveBeenCalled();
  });

  it('registers an AppState listener', () => {
    startMemorySampling();
    expect(AppState.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );
  });
});
