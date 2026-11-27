/**
 * 统一的运行入口：不依赖 npm / pnpm，只需 node。
 * 用法：node scripts/run.mjs <dev|preview|build|typecheck|lint|test|e2e|verify>
 *
 * 两个环境相关的坑都在这里处理掉：
 *  1. ELECTRON_RUN_AS_NODE=1 会让 electron.exe 退化成纯 Node，启动直接失败 → 启动前剔除；
 *  2. 部分终端禁止执行 .ps1，所以这里直接调各工具的入口文件，不经过 npm 脚本。
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const TASKS = {
  dev: ['node_modules/electron-vite/bin/electron-vite.js', ['dev']],
  preview: ['node_modules/electron-vite/bin/electron-vite.js', ['preview']],
  build: ['node_modules/electron-vite/bin/electron-vite.js', ['build']],
  typecheck: ['node_modules/typescript/bin/tsc', ['--noEmit']],
  lint: ['node_modules/eslint/bin/eslint.js', ['.']],
  test: ['node_modules/vitest/vitest.mjs', ['run']],
  e2e: ['node_modules/@playwright/test/cli.js', ['test']],
}

function run(task) {
  const [script, args] = TASKS[task]
  const entry = join(root, script)
  if (!existsSync(entry)) {
    console.error(`找不到 ${script}，请先在项目目录执行依赖安装（见 README）。`)
    process.exit(1)
  }

  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE

  const child = spawn(process.execPath, [entry, ...args], {
    cwd: root,
    env,
    stdio: 'inherit',
  })
  child.on('exit', (code, signal) => {
    if (signal) process.exit(1)
    process.exit(code ?? 0)
  })
}

const task = process.argv[2]

if (!task) {
  console.log(`用法：node scripts/run.mjs <${Object.keys(TASKS).join('|')}|verify>`)
  process.exit(1)
}

if (task === 'verify') {
  const sequence = ['typecheck', 'lint', 'test', 'build']
  for (const step of sequence) {
    console.log(`\n=== ${step} ===`)
    const [script, args] = TASKS[step]
    const code = await new Promise((resolve) => {
      const env = { ...process.env }
      delete env.ELECTRON_RUN_AS_NODE
      spawn(process.execPath, [join(root, script), ...args], {
        cwd: root,
        env,
        stdio: 'inherit',
      }).on('exit', resolve)
    })
    if (code !== 0) {
      console.error(`\n${step} 失败，已中止。`)
      process.exit(code ?? 1)
    }
  }
  console.log('\n全部通过：typecheck / lint / test / build')
  process.exit(0)
}

if (!(task in TASKS)) {
  console.error(`未知任务：${task}`)
  process.exit(1)
}

run(task)
