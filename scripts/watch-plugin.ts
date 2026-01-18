/**
 * 监视 plugins/opencode 目录变更并自动 build
 * 用于开发时快速更新插件
 *
 * 使用: bun run watch:plugin
 */

import { watch } from 'fs';
import { spawn } from 'bun';
import path from 'path';

const PLUGIN_DIR = path.join(import.meta.dir, '../plugins/opencode');
const SRC_DIR = path.join(PLUGIN_DIR, 'src');

// 防抖定时器
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 100;

// 颜色输出
const log = {
  info: (msg: string) => console.log(`\x1b[36m[watch]\x1b[0m ${msg}`),
  success: (msg: string) => console.log(`\x1b[32m[build]\x1b[0m ${msg}`),
  error: (msg: string) => console.log(`\x1b[31m[error]\x1b[0m ${msg}`),
  change: (file: string) => console.log(`\x1b[33m[change]\x1b[0m ${file}`),
};

async function build(): Promise<boolean> {
  const startTime = Date.now();

  try {
    const proc = spawn(['bun', 'run', 'build'], {
      cwd: PLUGIN_DIR,
      stdout: 'inherit',
      stderr: 'inherit',
    });

    const exitCode = await proc.exited;

    if (exitCode === 0) {
      log.success(`构建完成 (${Date.now() - startTime}ms)`);
      return true;
    } else {
      log.error(`构建失败，退出码: ${exitCode}`);
      return false;
    }
  } catch (error) {
    log.error(`构建出错: ${error}`);
    return false;
  }
}

function scheduleBuild(filename: string | null) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(async () => {
    if (filename) {
      log.change(filename);
    }
    await build();
  }, DEBOUNCE_MS);
}

async function main() {
  log.info(`监视目录: ${SRC_DIR}`);
  log.info('按 Ctrl+C 退出\n');

  // 初始构建
  log.info('执行初始构建...');
  await build();
  console.log('');

  // 监视文件变更
  watch(SRC_DIR, { recursive: true }, (_event, filename) => {
    // 忽略临时文件和非源码文件
    if (filename && (filename.endsWith('~') || filename.startsWith('.'))) {
      return;
    }
    scheduleBuild(filename ? filename.toString() : null);
  });

  log.info('监视中... 修改文件后将自动重新构建');
}

main().catch((err) => {
  log.error(`启动失败: ${err}`);
  process.exit(1);
});
