import React from 'react';
import {SafeAreaView, StyleSheet} from 'react-native';
import Editor from './src/components/Editor';
import FileExplorer from './src/components/FileExplorer';
import TabletResponsive from './src/layout/TabletResponsive';

const App = () => {
  return (
    <SafeAreaView style={styles.container}>
      <TabletResponsive>
        <FileExplorer />
        <Editor />
      </TabletResponsive>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
});

export default App;
