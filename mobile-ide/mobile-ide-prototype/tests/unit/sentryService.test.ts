import * as Sentry from '@sentry/react-native';
import { init, captureError, addBreadcrumb, setContext } from '../../src/observability/sentryService';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  setContext: jest.fn(),
}));

const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://test@test.ingest.sentry.io/123';
});

afterAll(() => {
  process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
});

describe('init()', () => {
  it('calls Sentry.init with the DSN from env', () => {
    init();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://test@test.ingest.sentry.io/123' })
    );
  });

  it('sets tracesSampleRate: 0.3', () => {
    init();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ tracesSampleRate: 0.3 })
    );
  });

  it('logs a warning and does not call Sentry.init when DSN is missing', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = '';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    init();
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SENTRY_DSN'));
    warnSpy.mockRestore();
  });

  it('passes scrubEvent as beforeSend', () => {
    init();
    const call = (Sentry.init as jest.Mock).mock.calls[0][0];
    expect(typeof call.beforeSend).toBe('function');
  });
});

describe('captureError()', () => {
  it('calls Sentry.captureException with the error', () => {
    init();
    const err = new Error('test crash');
    captureError(err);
    expect(Sentry.captureException).toHaveBeenCalledWith(err, expect.anything());
  });

  it('passes context as extra data', () => {
    init();
    const err = new Error('test');
    captureError(err, { usedMb: 72 });
    expect(Sentry.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ extra: { usedMb: 72 } })
    );
  });
});

describe('addBreadcrumb()', () => {
  it('calls Sentry.addBreadcrumb with category and message', () => {
    addBreadcrumb('file', 'File opened', { path: '/doc.ts' });
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'file', message: 'File opened' })
    );
  });
});

describe('setContext()', () => {
  it('calls Sentry.setContext with key and value', () => {
    setContext('memory', { usedMb: 45 });
    expect(Sentry.setContext).toHaveBeenCalledWith('memory', { usedMb: 45 });
  });
});
