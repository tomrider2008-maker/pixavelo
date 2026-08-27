import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { removeSupersededCssDeclarations } from './build/css/removeSupersededCssDeclarations.ts';

const packageManifest = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { name: string; version: string };

function gitOutput(args: readonly string[]) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

const releaseRevision =
  process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA ?? gitOutput(['rev-parse', 'HEAD']);
const releaseBuiltAt =
  process.env.SOURCE_DATE_EPOCH !== undefined
    ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
    : gitOutput(['show', '-s', '--format=%cI', 'HEAD']) || new Date(0).toISOString();
const releaseMetadata = {
  schemaVersion: 1,
  application: packageManifest.name,
  version: packageManifest.version,
  revision: releaseRevision || 'unknown',
  builtAt: releaseBuiltAt,
  dirty: gitOutput(['status', '--porcelain', '--untracked-files=all']).length > 0
};

export default defineConfig({
  css: {
    postcss: {
      plugins: [
        removeSupersededCssDeclarations({
          authoritativeSourceSuffixes: ['/src/styles/phase14.css']
        })
      ]
    }
  },
  plugins: [
    react(),
    {
      name: 'pixavelo-release-metadata',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'release.json',
          source: `${JSON.stringify(releaseMetadata, null, 2)}\n`
        });
      }
    },
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/pixavelo.svg'],
      manifest: {
        name: 'Pixavelo — Private Image Processing Studio',
        short_name: 'Pixavelo',
        description:
          'Convert, optimize, resize, batch-process, edit, privacy-clean and generate web assets locally in your browser.',
        theme_color: '#0d1420',
        background_color: '#070b13',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/pixavelo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/icons/pixavelo-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        globIgnores: [
          '**/avif-*.js',
          '**/avif_enc*.js',
          '**/encode-*.js',
          '**/avifCodec-*.js',
          '**/avifDecoder-*.js',
          '**/decode-*.js',
          '**/heic-*.js',
          '**/heifCodec-*.js',
          '**/heifDecoder-*.js',
          '**/tiffCodec-*.js',
          '**/tiffDecoder-*.js'
        ],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/(?:avif|decode|heic|heif|tiff)[^/]*\.(?:js|wasm)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pixavelo-codecs-v1',
              expiration: { maxEntries: 8, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] }
            }
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 650
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    exclude: ['e2e/**', 'live-e2e/**', 'node_modules/**', 'dist/**'],
    pool: 'threads',
    maxWorkers: 1,
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/components/ui/Dialog.tsx',
        'src/engine/export/createZip.ts',
        'src/features/resize/cropMath.ts',
        'src/features/converter/naming.ts',
        'src/features/converter/presets.ts',
        'src/features/batch/recipe.ts',
        'src/features/batch/statistics.ts',
        'src/features/batch/virtualWindow.ts',
        'src/features/editor/history.ts',
        'src/features/editor/recipe.ts',
        'src/engine/errors/**/*.ts',
        'src/engine/memory/**/*.ts',
        'src/engine/pipeline/encodeToTarget.ts',
        'src/engine/pipeline/geometry.ts',
        'src/engine/pipeline/imageAdjustments.ts',
        'src/engine/pipeline/applyPixelEdits.ts',
        'src/engine/registry/**/*.ts',
        'src/engine/validation/**/*.ts',
        'src/features/intake/analyzeIntakeSelection.ts',
        'src/features/intake/recommendIntakeActions.ts',
        'src/features/tools/useIncomingImageTool.ts',
        'src/features/tools/useIntakeSessionConsumer.ts',
        'src/features/welcome/welcomePreference.ts',
        'src/services/intakeSession.ts',
        'src/stores/localWorkGuard.ts',
        'src/utils/**/*.ts'
      ],
      thresholds: {
        statements: 65,
        branches: 50,
        functions: 60,
        lines: 65
      }
    }
  }
});
