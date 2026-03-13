const React = require('react');
const { View } = require('react-native');

const MockWebView = React.forwardRef((props, ref) => {
  React.useImperativeHandle(ref, () => ({
    injectJavaScript: jest.fn(),
  }));
  return React.createElement(View, {
    testID: props.testID ?? 'webview-unknown',
    onMessage: props.onMessage,
  });
});

MockWebView.displayName = 'MockWebView';
module.exports = { __esModule: true, default: MockWebView, WebView: MockWebView };
