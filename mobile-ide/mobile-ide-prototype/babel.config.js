module.exports = {
  presets: ['babel-preset-expo'],
  overrides: [
    {
      // react-native@0.81+ uses TypeScript type annotations in .js jest setup files.
      // @react-native/babel-preset only enables TypeScript transform for .ts/.tsx by
      // extension check — apply it explicitly for the RN jest directory.
      include: [/node_modules\/react-native\/jest\//],
      presets: [
        ['@babel/preset-typescript', { allExtensions: true, isTSX: true }],
      ],
    },
  ],
};
