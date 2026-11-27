import { expect, test, _electron as electron } from '@playwright/test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const EXE = join(process.cwd(), 'release', 'win-unpacked', '小说阅读器.exe')

// 只有跑过 `node scripts/run.mjs dist` 之后才有产物；没打包时自动跳过。
test.skip(!existsSync(EXE), `未找到打包产物：${EXE}`)

test('打包产物可启动、渲染书架、版本号正确', async () => {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (k === 'ELECTRON_RUN_AS_NODE' || v === undefined) continue
    env[k] = v
  }

  const started = Date.now()
  const app = await electron.launch({ executablePath: EXE, args: [], env })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  const startupMs = Date.now() - started

  await expect(win.getByRole('heading', { name: '书架' })).toBeVisible({ timeout: 30_000 })

  // 版本号来自 package.json，打包后应为 0.2.0
  const version = await win.evaluate(() => window.api.app.getVersion())
  expect(version).toBe('0.2.0')

  // preload 仍是白名单 API（打包后 asar 路径不能把安全基线弄丢）
  const apiKeys = await win.evaluate(() => Object.keys(window.api).sort())
  expect(apiKeys).toEqual(['app', 'dialog', 'file', 'window'])

  console.log(JSON.stringify({ startupMs, version }, null, 2))
  // 冷启动目标 < 3s（《开发框架.md》M5）
  expect(startupMs).toBeLessThan(3000)

  await app.close()
})
