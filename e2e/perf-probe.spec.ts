import { expect, test, _electron as electron } from '@playwright/test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const ARTIFACTS = join(process.cwd(), 'test-results')
/** 与 tests/real-book.test.ts 一致：环境变量优先，否则用项目根的 local-book.txt */
const REAL_BOOK = process.env.REAL_BOOK_PATH ?? join(process.cwd(), 'local-book.txt')

// 性能探针：把耗时与渲染节点数打到日志里，并断言目录虚拟化确实生效。
// 没有本地大样本时自动跳过（文件不入库）。
test.skip(!existsSync(REAL_BOOK), `缺少真实书库样本：${REAL_BOOK}`)

test('perf: 真实书导入、目录虚拟化与换章耗时', async () => {
  const env: Record<string, string> = {
    NODE_ENV: 'production',
    NOVEL_READER_USER_DATA: join(ARTIFACTS, 'userdata-perf'),
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (k === 'ELECTRON_RUN_AS_NODE' || v === undefined) continue
    env[k] = v
  }
  const app = await electron.launch({ args: ['.'], cwd: process.cwd(), env })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
  }, REAL_BOOK)

  const t0 = Date.now()
  await win.getByRole('button', { name: '导入书籍' }).click()
  await expect(win.getByRole('heading', { name: /前言|第一章/ })).toBeVisible({ timeout: 180_000 })
  const importMs = Date.now() - t0

  const sectionCount = await win.evaluate(() => {
    const m = document.body.innerText.match(/(\d+)\s*\/\s*(\d+)/)
    return m ? Number(m[2]) : -1
  })

  const t1 = Date.now()
  await win.locator('header').getByRole('button', { name: '目录' }).click()
  await expect(win.locator('[aria-label="章节目录"] button').first()).toBeVisible({ timeout: 60_000 })
  const tocMs = Date.now() - t1

  // 虚拟滚动：3873 章只应渲染可视区附近的几十项
  const renderedRows = await win.locator('[aria-label="章节目录"] button').count()

  const t2 = Date.now()
  await win.locator('footer').getByRole('button', { name: '下一章' }).click()
  await expect(win.locator('article p').first()).toBeVisible({ timeout: 60_000 })
  const nextChapterWithTocMs = Date.now() - t2

  await win.locator('header').getByRole('button', { name: '目录' }).click()
  await expect(win.locator('[aria-label="章节目录"] button').first()).toBeHidden({ timeout: 10_000 })

  const t3 = Date.now()
  await win.locator('footer').getByRole('button', { name: '下一章' }).click()
  await expect(win.locator('article p').first()).toBeVisible({ timeout: 60_000 })
  const nextChapterNoTocMs = Date.now() - t3

  console.log(
    JSON.stringify(
      {
        importMs,
        sectionCount,
        tocMs,
        renderedRows,
        nextChapterWithTocMs,
        nextChapterNoTocMs,
      },
      null,
      2,
    ),
  )

  await win.screenshot({ path: join(ARTIFACTS, 'real-book.png') })

  // v0.2 目录虚拟化：实际渲染条目必须远小于章节总数
  expect(sectionCount).toBeGreaterThan(500)
  expect(renderedRows).toBeLessThan(80)
  // 目录展开时换章不再被目录全量渲染拖慢（v0.1 基线在 800ms 量级）
  expect(nextChapterWithTocMs).toBeLessThan(400)

  await app.close()
})
