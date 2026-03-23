/**
 * Unit tests — ExtensionHost
 *
 * WebView is mocked via __mocks__/react-native-webview.js.
 * Tests verify message routing from WebView → host callbacks.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ExtensionHost from '../../src/components/ExtensionHost';
import type { ExtensionManifest } from '../../src/extensions/sandbox';

const MANIFEST_A: ExtensionManifest = {
  id: 'test.a',
  name: 'Extension A',
  version: '1.0.0',
  source: 'void 0;',
};

const MANIFEST_B: ExtensionManifest = {
  id: 'test.b',
  name: 'Extension B',
  version: '1.0.0',
  source: 'void 0;',
};

const defaultProps = {
  manifests: [] as ExtensionManifest[],
  onGetEditorContent: jest.fn(() => 'editor content'),
  onReplaceEditorContent: jest.fn(),
  onShowMessage: jest.fn(),
  onShowError: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('ExtensionHost', () => {
  it('renders null with empty manifests', () => {
    const { toJSON } = render(<ExtensionHost {...defaultProps} manifests={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders one WebView per manifest', () => {
    render(<ExtensionHost {...defaultProps} manifests={[MANIFEST_A, MANIFEST_B]} />);
    expect(screen.getByTestId('exthost-webview-test.a')).toBeTruthy();
    expect(screen.getByTestId('exthost-webview-test.b')).toBeTruthy();
  });

  it('calls onShowMessage when showMessage type received', () => {
    const onShowMessage = jest.fn();
    render(
      <ExtensionHost
        {...defaultProps}
        manifests={[MANIFEST_A]}
        onShowMessage={onShowMessage}
      />
    );
    const webview = screen.getByTestId('exthost-webview-test.a');
    webview.props.onMessage({
      nativeEvent: {
        data: JSON.stringify({ type: 'showMessage', extensionId: 'test.a', payload: { text: 'Hello' } }),
      },
    });
    expect(onShowMessage).toHaveBeenCalledWith('Hello');
  });

  it('calls onShowError when showError type received', () => {
    const onShowError = jest.fn();
    render(
      <ExtensionHost
        {...defaultProps}
        manifests={[MANIFEST_A]}
        onShowError={onShowError}
      />
    );
    const webview = screen.getByTestId('exthost-webview-test.a');
    webview.props.onMessage({
      nativeEvent: {
        data: JSON.stringify({ type: 'showError', extensionId: 'test.a', payload: { text: 'Oops' } }),
      },
    });
    expect(onShowError).toHaveBeenCalledWith('Oops');
  });

  it('calls onReplaceEditorContent when replaceEditorContent type received', () => {
    const onReplaceEditorContent = jest.fn();
    render(
      <ExtensionHost
        {...defaultProps}
        manifests={[MANIFEST_A]}
        onReplaceEditorContent={onReplaceEditorContent}
      />
    );
    const webview = screen.getByTestId('exthost-webview-test.a');
    webview.props.onMessage({
      nativeEvent: {
        data: JSON.stringify({
          type: 'replaceEditorContent',
          extensionId: 'test.a',
          payload: { text: 'new content' },
        }),
      },
    });
    expect(onReplaceEditorContent).toHaveBeenCalledWith('new content');
  });

  it('calls onShowError when error type received from extension', () => {
    const onShowError = jest.fn();
    render(
      <ExtensionHost
        {...defaultProps}
        manifests={[MANIFEST_A]}
        onShowError={onShowError}
      />
    );
    const webview = screen.getByTestId('exthost-webview-test.a');
    webview.props.onMessage({
      nativeEvent: {
        data: JSON.stringify({
          type: 'error',
          extensionId: 'test.a',
          payload: { message: 'ReferenceError: x is not defined' },
        }),
      },
    });
    expect(onShowError).toHaveBeenCalledWith(expect.stringContaining('ReferenceError'));
  });

  it('ignores malformed JSON from WebView', () => {
    const onShowMessage = jest.fn();
    render(
      <ExtensionHost
        {...defaultProps}
        manifests={[MANIFEST_A]}
        onShowMessage={onShowMessage}
      />
    );
    const webview = screen.getByTestId('exthost-webview-test.a');
    expect(() => {
      webview.props.onMessage({ nativeEvent: { data: 'not json' } });
    }).not.toThrow();
    expect(onShowMessage).not.toHaveBeenCalled();
  });
});
