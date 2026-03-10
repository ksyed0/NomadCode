/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'detox.jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },

  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/NomadCode.app',
      build: [
        'xcodebuild',
        '-workspace ios/NomadCode.xcworkspace',
        '-scheme NomadCode',
        '-configuration Debug',
        '-sdk iphonesimulator',
        '-derivedDataPath ios/build',
        'ENTRY_FILE=index.js',
      ].join(' '),
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/NomadCode.app',
      build: [
        'xcodebuild',
        '-workspace ios/NomadCode.xcworkspace',
        '-scheme NomadCode',
        '-configuration Release',
        '-sdk iphonesimulator',
        '-derivedDataPath ios/build',
        'ENTRY_FILE=index.js',
      ].join(' '),
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      reversePorts: [8081],
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build: 'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
    },
  },

  devices: {
    'ipad.sim': {
      type: 'ios.simulator',
      device: {
        type: 'iPad Pro (12.9-inch) (6th generation)',
      },
    },
    'iphone.sim': {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15',
      },
    },
    'android.emu': {
      type: 'android.emulator',
      device: { avdName: 'test' },
    },
  },

  configurations: {
    // ── Primary E2E targets ───────────────────────────────────────────────
    'ios.ipad.debug': {
      device: 'ipad.sim',
      app: 'ios.debug',
    },
    'ios.ipad.release': {
      device: 'ipad.sim',
      app: 'ios.release',
    },
    'ios.iphone.debug': {
      device: 'iphone.sim',
      app: 'ios.debug',
    },
    'android.emu.debug': {
      device: 'android.emu',
      app: 'android.debug',
    },
    'android.emu.release': {
      device: 'android.emu',
      app: 'android.release',
    },
  },
};
