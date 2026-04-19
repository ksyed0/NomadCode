/**
 * Type declarations for static asset imports.
 * React Native's Metro bundler handles these at runtime; TypeScript needs
 * the module declarations so tsc does not error on `import foo from '*.png'`.
 */
declare module '*.png' {
  const value: number;
  export default value;
}

declare module '*.jpg' {
  const value: number;
  export default value;
}

declare module '*.jpeg' {
  const value: number;
  export default value;
}

declare module '*.gif' {
  const value: number;
  export default value;
}

declare module '*.webp' {
  const value: number;
  export default value;
}

declare module '*.svg' {
  const value: number;
  export default value;
}
