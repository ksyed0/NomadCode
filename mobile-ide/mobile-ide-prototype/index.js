// Polyfill Node.js Buffer global — required by isomorphic-git.
// Must be imported before any code that uses Buffer.
import { Buffer } from 'buffer';
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
