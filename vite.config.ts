import path from "path";
import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

const host = process.env.TAURI_DEV_HOST;
const isProd = process.env.NODE_ENV === "production";

// https://vite.dev/config/
export default defineConfig(async (): Promise<UserConfig> => ({
  plugins: [
    tanstackRouter({ quoteStyle: "double" }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // ==================== 构建优化配置 ====================
  build: {
    // 目标浏览器（Tauri WebView 使用最新 Chromium，支持最新特性）
    target: "esnext",
    // 使用 esbuild 压缩（比 terser 快 20-40x）
    minify: "esbuild",
    // 生产环境禁用 sourcemap
    sourcemap: false,
    // chunk 大小警告阈值（KB）
    chunkSizeWarningLimit: 500,
    // CSS 代码分割（单一 CSS 文件更利于缓存）
    cssCodeSplit: false,
    // 内联小于 4KB 的资源为 base64
    assetsInlineLimit: 4096,
    // Rollup 配置
    rollupOptions: {
      output: {
        // ============ 代码分割策略 ============
        // 将依赖分割成多个 chunk，优化首屏加载和缓存
        // 使用对象形式避免循环依赖问题
        manualChunks: {
          // React 核心 - 首屏必需
          "vendor-react": ["react", "react-dom", "scheduler"],
          // 路由和数据获取
          "vendor-router": [
            "@tanstack/react-router",
            "@tanstack/react-query",
            "zustand",
          ],
          // Radix UI 组件库
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-context-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
          ],
          // 代码高亮 - 懒加载
          "vendor-syntax": ["react-syntax-highlighter"],
          // Markdown 渲染
          "vendor-markdown": ["react-markdown", "remark-gfm"],
          // 国际化
          "vendor-i18n": [
            "i18next",
            "react-i18next",
            "i18next-browser-languagedetector",
          ],
          // Tauri API
          "vendor-tauri": ["@tauri-apps/api", "@tauri-apps/plugin-opener"],
          // 图标库
          "vendor-icons": ["lucide-react"],
        },
        // chunk 文件名（使用内容哈希便于长期缓存）
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name || "chunk";
          return `assets/${name}-[hash].js`;
        },
        // 入口文件名
        entryFileNames: "assets/[name]-[hash].js",
        // 资源文件名
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || "";
          // 字体文件
          if (/\.(woff2?|eot|ttf|otf)$/i.test(name)) {
            return "assets/fonts/[name]-[hash][extname]";
          }
          // 图片文件
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(name)) {
            return "assets/images/[name]-[hash][extname]";
          }
          // CSS 文件
          if (name.endsWith(".css")) {
            return "assets/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },

  // ==================== 依赖预构建优化 ====================
  optimizeDeps: {
    // 预构建的依赖（加速开发模式冷启动）
    include: [
      "react",
      "react-dom",
      "@tanstack/react-router",
      "@tanstack/react-query",
      "zustand",
      "i18next",
      "react-i18next",
      "lucide-react",
      // Radix UI 常用组件
      "@radix-ui/react-dialog",
      "@radix-ui/react-popover",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-scroll-area",
    ],
    // 排除懒加载的大型依赖（按需加载更优）
    exclude: [
      "react-syntax-highlighter",
    ],
    // 强制预构建（避免运行时发现新依赖导致刷新）
    force: false,
  },

  // ==================== esbuild 配置 ====================
  esbuild: {
    // 生产环境移除 console 和 debugger
    drop: isProd ? ["console", "debugger"] : [],
    // 使用自动 JSX runtime
    jsx: "automatic",
    // 压缩标识符
    minifyIdentifiers: isProd,
    minifySyntax: isProd,
    minifyWhitespace: isProd,
  },

  // ==================== CSS 配置 ====================
  css: {
    // CSS 模块配置
    modules: {
      // 生成更短的类名（生产环境）
      generateScopedName: isProd ? "[hash:base64:5]" : "[name]__[local]",
    },
    // 开发模式使用 CSS 源码映射
    devSourcemap: !isProd,
  },

  // ==================== Tauri 特定配置 ====================
  // 1. 不清除控制台（保留 Rust 错误信息）
  clearScreen: false,
  // 2. 固定端口（Tauri 要求）
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. 忽略 src-tauri 目录
      ignored: ["**/src-tauri/**"],
    },
    // 预热常用文件（加速首次请求）
    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/App.tsx",
        "./src/index.css",
        "./src/router.ts",
      ],
    },
  },

  // ==================== 预览服务器配置 ====================
  preview: {
    port: 1420,
    strictPort: true,
  },
}));
