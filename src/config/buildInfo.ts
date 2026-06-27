// Single accessor for the app's build metadata. Uses `typeof` guards so it is
// safe to import outside a Vite build (e.g. unit tests) where the compile-time
// `define` replacements are absent.
export const buildInfo = {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0',
  hash: typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'dev',
  builtAt: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '',
} as const;

export function buildLabel(): string {
  return `v${buildInfo.version} · ${buildInfo.hash}`;
}
