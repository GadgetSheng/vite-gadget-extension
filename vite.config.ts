import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import zip from 'vite-plugin-zip-pack'
import manifest from './manifest.config.js'
import { name, version } from './package.json'
import fs from 'node:fs/promises'
import esbuild from 'esbuild'

const injectTs = path.resolve(__dirname, 'src/content/inject.js')
const sidepanelTs = path.resolve(__dirname, 'src/sidepanel/index.html')

/**
 * inject 在页面 MAIN world 以普通 <script> 执行，顶层 let/const 会进入页面全局词法环境，
 * 与部分站点已有绑定（如 minify 后的 A、u）冲突。包成 IIFE 后全部落在函数作用域内。
 */
function injectAsIife(): Plugin {
  return {
    name: 'inject-as-iife',
    renderChunk(code, chunk) {
      const id = chunk.facadeModuleId?.replace(/\\/g, '/')
      if (!chunk.isEntry || !id?.endsWith('/src/content/inject.js')) return null
      return {
        code: `(function(){\n${code}\n})();`,
        map: null,
      }
    },
  }
}

/**
 * Dev 模式下将 inject.js 编译输出（处理 IIFE 包裝），
 * 避免 extension 加载 src/content/inject.js 时 404。
 */
function devInjectPlugin(): Plugin {
  return {
    name: 'dev-inject',
    configureServer(server) {
      server.middlewares.use('/src/content/inject.js', async (_req, res) => {
        try {
          const filePath = path.resolve(__dirname, 'src/content/inject.js')
          const raw = await fs.readFile(filePath, 'utf8')
          const result = await esbuild.transform(raw, {
            loader: 'js',
            legalComments: 'none',
          })
          // IIFE 包装（与 injectAsIife 保持一致）
          const code = `(function(){\n${result.code}\n})();`
          res.setHeader('Content-Type', 'application/javascript')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(code)
        } catch (e) {
          console.error('[dev-inject] transform error:', e)
          res.statusCode = 500
          res.end('Transform error')
        }
      })
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
    devInjectPlugin(),
    zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` }),
  ],
  build: {
    rollupOptions: {
      input: {
        inject: injectTs,
        sidepanel: sidepanelTs,
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
