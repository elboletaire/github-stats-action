import { defineConfig } from 'tsdown';

// dist/index.js is the action and dist/cli.js the github-stats bin. Each is one file with every
// dependency bundled, so nothing is installed at run time.
const bundle = (name: string, entry: string, clean: boolean) =>
  defineConfig({
    entry: { [name]: entry },
    format: 'esm',
    platform: 'node',
    target: 'node24',
    outDir: 'dist',
    clean,
    noExternal: [/.*/],
    deps: { onlyBundle: false },
    outExtensions: () => ({ js: '.js' }),
    dts: false,
    sourcemap: false,
  });

export default [
  bundle('index', 'packages/action/src/main.ts', true),
  bundle('cli', 'packages/action/src/bin.ts', false),
];
