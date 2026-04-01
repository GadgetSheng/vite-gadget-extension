import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import zip from 'vite-plugin-zip-pack'
import manifest from './manifest.config.js'
import { name, version } from './package.json'

const injectTs = path.resolve(__dirname, 'src/content/inject.ts')

/**
 * inject 在页面 MAIN world 以普通 <script> 执行，顶层 let/const 会进入页面全局词法环境，
 * 与部分站点已有绑定（如 minify 后的 A、u）冲突。包成 IIFE 后全部落在函数作用域内。
 */
function injectAsIife(): Plugin {
  return {
    name: 'inject-as-iife',
    renderChunk(code, chunk) {
      const id = chunk.facadeModuleId?.replace(/\\/g, '/')
      if (!chunk.isEntry || !id?.endsWith('/src/content/inject.ts')) return null
      return {
        code: `(function(){\n${code}\n})();`,
        map: null,
      }
    },
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@': `${path.resolve(__dirname, 'src')}`,
    },
  },
  plugins: [
    react(),
    crx({ manifest }),
    injectAsIife(),
    zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` }),
  ],
  build: {
    rollupOptions: {
      input: {
        inject: injectTs,
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'inject') {
            return 'src/content/inject.js'
          }
          return 'assets/[name]-[hash].js'
        },
      },
    },
  },
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
  // Vitest merges `test` when running via `npm run test`
  // @ts-expect-error Vitest UserConfig extension
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
})
