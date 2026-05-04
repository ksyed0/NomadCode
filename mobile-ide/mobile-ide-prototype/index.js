// Polyfill Node.js Buffer global — required by isomorphic-git.
// Must be imported before any code that uses Buffer.
import { Buffer } from 'buffer';
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Initialise Sentry before registering the root component so that crashes
// during the initial render are captured. Must come before App import.
import { init as initSentry } from './src/observability/sentryService';
initSentry();

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
