module.exports = {
  presets: [
    'babel-preset-expo',
    // react-native@0.81+ ships jest/setup.js with TypeScript-annotated method
    // signatures in a .js file. @react-native/babel-preset only enables the TS
    // transform for .ts/.tsx via an extension check, so babel chokes on the syntax
    // when processing that file. Applying @babel/preset-typescript globally with
    // allExtensions:true ensures type annotations are stripped from any .js file
    // that happens to contain them. For plain JS files it is a no-op.
    ['@babel/preset-typescript', { allExtensions: true, isTSX: true }],
  ],
};
