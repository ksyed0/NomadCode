import React from 'react';
import {View, Text} from 'react-native';
import {WebView} from 'react-native-webview';

const Editor = () => {
  return (
    <View style={{flex: 1}}>
      <Text>Monaco Editor Placeholder</Text>
      <WebView source={{uri: 'https://microsoft.github.io/monaco-editor-samples/browser-sample/index.html'}} />
    </View>
  );
};

export default Editor;
