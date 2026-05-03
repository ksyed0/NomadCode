// mobile-ide/mobile-ide-prototype/global.d.ts
// Hermes exposes performance.memory in React Native — no @types declaration exists.
declare global {
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
}

export {};
