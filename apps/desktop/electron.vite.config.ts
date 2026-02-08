import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    entry: 'src/main/index.ts',
    outDir: 'dist/main',
    build: {
      rollupOptions: {
        external: ['electron-updater'],
      },
    },
  },
  preload: {
    input: {
      index: resolve(__dirname, 'src/preload/index.ts'),
    },
    outDir: 'dist/preload',
    vite: {
      build: {
        rollupOptions: {
          output: {
            format: 'cjs',
            entryFileNames: 'index.cjs',
          },
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      outDir: resolve(__dirname, 'dist/renderer'),
    },
    plugins: [react()],
  },
});
