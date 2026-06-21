import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    root: './',
    base: './',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: !isProduction,
      minify: isProduction ? 'terser' : false,
      terserOptions: isProduction ? {
        compress: {
          drop_console: true,
          drop_debugger: true,
          passes: 3,
          unsafe: true,
          pure_getters: true
        },
        mangle: {
          toplevel: true,
          properties: false
        },
        format: {
          comments: false
        }
      } : undefined,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
        output: {
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: ({ name }) => {
            if (/\.(gif|jpe?g|png|svg|webp|avif|mp4)$/.test(name ?? '')) {
              return 'assets/media/[name]-[hash].[ext]';
            }
            if (/\.css$/.test(name ?? '')) {
              return 'assets/css/[name]-[hash].[ext]';
            }
            return 'assets/[name]-[hash].[ext]';
          }
        }
      }
    }
  };
});
