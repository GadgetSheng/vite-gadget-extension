import fs from "node:fs";
import path from "node:path";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, transformWithEsbuild, type Plugin } from "vite";
import zip from "vite-plugin-zip-pack";
import manifest from "./manifest.config.js";
import { name, version } from "./package.json";

const injectTs = path.resolve(__dirname, "src/content/inject.ts");
const injectJs = path.resolve(__dirname, "src/content/inject.js");

/**
 * inject 在页面 MAIN world 以普通 <script> 执行，顶层 let/const 会进入页面全局词法环境，
 * 与部分站点已有绑定（如 minify 后的 A、u）冲突。包成 IIFE 后全部落在函数作用域内。
 */
function injectAsIife(): Plugin {
	return {
		name: "inject-as-iife",
		renderChunk(code, chunk) {
			const id = chunk.facadeModuleId?.replace(/\\/g, "/");
			if (!chunk.isEntry || !id?.endsWith("/src/content/inject.ts"))
				return null;
			return {
				code: `(function(){\n${code}\n})();`,
				map: null,
			};
		},
	};
}

/**
 * Dev mode only: pre-compiles inject.ts → inject.js on disk so crxjs can
 * serve it as a web-accessible resource.  crxjs runs its own Rollup 2 build
 * (without TypeScript plugins), so inject.ts cannot be listed directly as a
 * rollupOptions entry during dev.
 */
function devInjectScript(): Plugin {
	async function compile() {
		const src = fs.readFileSync(injectTs, "utf-8");
		const result = await transformWithEsbuild(src, injectTs, {
			format: "iife",
			target: "chrome90",
			minify: false,
		});
		fs.writeFileSync(injectJs, result.code);
	}

	return {
		name: "dev-inject-script",
		apply: "serve",
		async configResolved() {
			await compile();
		},
		async handleHotUpdate({ file }) {
			if (file === injectTs) {
				await compile();
			}
		},
	};
}

export default defineConfig(({ command }) => ({
	resolve: {
		alias: {
			"@": `${path.resolve(__dirname, "src")}`,
		},
	},
	plugins: [
		devInjectScript(),
		react(),
		crx({ manifest }),
		injectAsIife(),
		zip({ outDir: "release", outFileName: `crx-${name}-${version}.zip` }),
	],
	build: {
		rollupOptions:
			command === "build"
				? {
						input: {
							inject: injectTs,
						},
						output: {
							entryFileNames: (chunkInfo) => {
								if (chunkInfo.name === "inject") {
									return "src/content/inject.js";
								}
								return "assets/[name]-[hash].js";
							},
						},
					}
				: {},
	},
	server: {
		port: 5173,
		hmr: {
			port: 5173,
		},
		cors: {
			origin: [/chrome-extension:\/\//],
		},
	},
	// Vitest merges `test` when running via `npm run test`
	test: {
		environment: "node",
		include: ["__tests__/**/*.test.ts"],
	},
}));
