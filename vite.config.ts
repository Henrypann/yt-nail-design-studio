import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run dev -- --host 0.0.0.0 --port 7100` 的 CLI 参数由 Vite 原生透传处理。

/**
 * 静态资产服务（Wizard 十指渲染器消费）：
 * 将仓库根的 material-library/ 与 assets/ 以同源 URL（/material-library/*、/assets/*）暴露。
 * - dev：中间件流式返回（SVG/JSON/PNG），含路径穿越防护；
 * - build：closeBundle 时拷贝进 dist/（assets/ 与 Vite 产物目录合并，子目录无冲突）。
 * 前端一律 fetch 清单 JSON，不硬编码素材路径（DEV-PLAN §2.3-8）。
 */
function serveStaticAssets(): Plugin {
  const roots: Record<string, string> = {
    '/material-library/': fileURLToPath(new URL('./material-library', import.meta.url)),
    '/assets/': fileURLToPath(new URL('./assets', import.meta.url)),
  };
  const mime: Record<string, string> = {
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.glb': 'model/gltf-binary',
    '.stl': 'model/stl',
    '.md': 'text/markdown; charset=utf-8',
  };
  /** Internal review/build inputs must never be copied to or served by the web app. */
  const isRuntimeAsset = (rootPrefix: string, relativePath: string): boolean => {
    const normalized = relativePath.split(path.sep).join('/');
    if (normalized.endsWith('.bak') || normalized.endsWith('.raw.glb') || normalized.endsWith('.stl')) return false;
    if (rootPrefix === '/assets/' && (normalized.startsWith('golden-fixtures/') || normalized.startsWith('shape-calibration/'))) return false;
    return true;
  };
  return {
    name: 'nail-studio-static-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url ?? '';
        // 带 query 的是 Vite 模块请求（import.meta.glob ?raw / ?url 等），
        // 必须交给 Vite 管线；仅裸路径（fetch 清单/素材）走本静态服务。
        if (rawUrl.includes('?')) {
          next();
          return;
        }
        const url = decodeURIComponent(rawUrl);
        for (const [prefix, dir] of Object.entries(roots)) {
          if (!url.startsWith(prefix)) continue;
          const file = path.resolve(dir, url.slice(prefix.length));
          const relativePath = path.relative(dir, file);
          const inside = file === dir || file.startsWith(dir + path.sep);
          if (!inside || !isRuntimeAsset(prefix, relativePath) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }
          res.setHeader('Content-Type', mime[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
          fs.createReadStream(file).pipe(res);
          return;
        }
        next();
      });
    },
    closeBundle() {
      const dist = fileURLToPath(new URL('./dist', import.meta.url));
      for (const [prefix, dir] of Object.entries(roots)) {
        fs.cpSync(dir, path.join(dist, prefix.replace(/^\/|\/$/g, '')), {
          recursive: true,
          filter: (source) => isRuntimeAsset(prefix, path.relative(dir, source)),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), serveStaticAssets()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
  },
});
