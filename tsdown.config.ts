import { defineConfig } from 'tsdown';

// The action is one file: every dependency is bundled, so nothing is installed at run time.
export default defineConfig({
  entry: { index: 'packages/action/src/main.ts' },
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  noExternal: [/.*/],
  deps: { onlyBundle: false },
  outExtensions: () => ({ js: '.js' }),
  dts: false,
  sourcemap: false,
});
