import { expect, test, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ARTIFACTS = join(process.cwd(), 'test-results')
const SAMPLE = join(process.cwd(), 'resources', 'samples', '01-standard-chapter.txt')
/** 长章节样例：每章约 3000 字，足够滚出视口 */
const LONG_SAMPLE = join(process.cwd(), 'resources', 'samples', '07-no-heading.txt')

async function launch(userData: string): Promise<{ app: ElectronApplication; win: Page }> {
  // 某些终端会带 ELECTRON_RUN_AS_NODE=1，那会让 electron.exe 退化成纯 Node
  const env: Record<string, string> = { NODE_ENV: 'production', NOVEL_READER_USER_DATA: userData }
  for (const [key, value] of Object.entries(process.env)) {
    if (key === 'ELECTRON_RUN_AS_NODE' || value === undefined) continue
    env[key] = value
  }
  const app = await electron.launch({ args: ['.'], cwd: process.cwd(), env })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  return { app, win }
}

test('启动冒烟：书架渲染 + preload 只暴露白名单 API', async () => {
  mkdirSync(ARTIFACTS, { recursive: true })
  const { app, win } = await launch(join(ARTIFACTS, 'userdata-smoke'))

  await expect(win.getByRole('heading', { name: '书架' })).toBeVisible()
  await expect(win.getByRole('button', { name: '导入书籍' })).toBeVisible()

  const version = await win.evaluate(() => window.api.app.getVersion())
  expect(version).toMatch(/^\d+\.\d+\.\d+/)

  const probe = await win.evaluate(() => ({
    hasRequire: typeof (globalThis as Record<string, unknown>).require,
    hasProcess: typeof (globalThis as Record<string, unknown>).process,
    apiKeys: Object.keys(window.api).sort(),
  }))
  expect(probe.hasRequire).toBe('undefined')
  expect(probe.hasProcess).toBe('undefined')
  expect(probe.apiKeys).toEqual(['app', 'dialog', 'file', 'window'])

  await win.screenshot({ path: join(ARTIFACTS, 'bookshelf.png') })
  await app.close()
})

test('导入 → 切章 → 阅读 → 调字号 全链路', async () => {
  mkdirSync(ARTIFACTS, { recursive: true })
  const { app, win } = await launch(join(ARTIFACTS, 'userdata-import'))

  // 把系统文件对话框换成固定返回样例书
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, SAMPLE)

  await win.getByRole('button', { name: '导入书籍' }).click()

  // 导入完成后进入阅读页，正文与章节标题都在
  await expect(win.getByRole('heading', { name: '第一章 风起1' })).toBeVisible({ timeout: 30_000 })
  await expect(win.locator('article p').first()).toContainText('他停在石阶上')
  await expect(win.locator('header')).toContainText('1 / 8')

  const readVar = () =>
    win.evaluate(() => {
      const el = document.querySelector('[style*="--reader-font-size"]') as HTMLElement | null
      return el?.style.getPropertyValue('--reader-font-size').trim() ?? ''
    })

  // 默认字号 20px，快捷键可增/减/复位
  expect(await readVar()).toBe('20px')
  await win.keyboard.press('Control+=')
  await expect.poll(readVar).toBe('21px')
  await win.keyboard.press('Control+-')
  await expect.poll(readVar).toBe('20px')
  await win.keyboard.press('Control+0')
  await expect.poll(readVar).toBe('20px')

  // 字号写入 localStorage
  expect(await win.evaluate(() => localStorage.getItem('reader.fontSize'))).toBe('20')

  // 工具栏 A+ 与快捷键共用同一套边界逻辑
  await win.getByRole('button', { name: 'A+', exact: true }).click()
  await expect.poll(readVar).toBe('21px')
  await win.screenshot({ path: join(ARTIFACTS, 'reader.png') })

  // 目录侧栏可展开，且展开后正文让位不被遮挡
  await win.locator('header').getByRole('button', { name: '目录' }).click()
  await expect(win.getByText('8 章', { exact: true })).toBeVisible()
  const articleLeft = await win.locator('article').evaluate((el) => el.getBoundingClientRect().left)
  expect(articleLeft).toBeGreaterThanOrEqual(290)
  await win.screenshot({ path: join(ARTIFACTS, 'reader-toc.png') })

  await app.close()
})

test('滚动不会被拉回顶部，且重启后能回到原位', async () => {
  const userData = join(ARTIFACTS, 'userdata-scroll')
  const scrollTop = (page: Page) => page.evaluate(() => document.querySelector('main')?.scrollTop ?? -1)

  const first = await launch(userData)
  await first.app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, LONG_SAMPLE)

  await first.win.getByRole('button', { name: '导入书籍' }).click()
  await expect(first.win.getByRole('heading', { name: '第 1 节' })).toBeVisible({ timeout: 30_000 })
  expect(await scrollTop(first.win)).toBe(0)

  // 向下滚动：曾经因为「每帧回写偏移」把 scrollTop 重置为 0，这里盯住它
  await first.win.locator('article').hover()
  await first.win.mouse.wheel(0, 900)
  await expect.poll(() => scrollTop(first.win), { timeout: 5_000 }).toBeGreaterThan(0)

  const scrolled = await scrollTop(first.win)
  await first.win.waitForTimeout(2_600) // 跨过 2s 的进度落盘窗口，确认不会被复位
  expect(await scrollTop(first.win)).toBe(scrolled)

  // 调字号后仍应停留在原位置附近，而不是跳回顶部
  await first.win.keyboard.press('Control+=')
  await first.win.waitForTimeout(300)
  expect(await scrollTop(first.win)).toBeGreaterThan(0)

  const offsetBeforeClose = await scrollTop(first.win)
  await first.app.close()

  // 重启后用同一份数据目录，重新打开这本书应回到上次位置
  const second = await launch(userData)
  await second.win.locator('article').first().click()
  await expect(second.win.getByRole('heading', { name: '第 1 节' })).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => scrollTop(second.win), { timeout: 5_000 }).toBeGreaterThan(0)
  const restored = await scrollTop(second.win)
  expect(Math.abs(restored - offsetBeforeClose)).toBeLessThan(120)

  await second.app.close()
})

test('v0.2：无边框沉浸阅读、主题切换与单书字号', async () => {
  const userData = join(ARTIFACTS, 'userdata-v02')
  const { app, win } = await launch(userData)

  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, LONG_SAMPLE)

  await win.getByRole('button', { name: '导入书籍' }).click()
  await expect(win.getByRole('heading', { name: '第 1 节' })).toBeVisible({ timeout: 30_000 })

  const headerTop = () => win.locator('header').evaluate((el) => el.getBoundingClientRect().top)
  const footerBottom = () =>
    win.locator('footer').evaluate((el) => el.getBoundingClientRect().bottom)
  const viewportHeight = await win.evaluate(() => window.innerHeight)

  // 开启无边框：默认只去掉描边，工具栏与底栏常驻（章末仍能直接翻章）
  expect(await headerTop()).toBeGreaterThanOrEqual(0)
  await win.getByRole('button', { name: '无边框沉浸阅读' }).click()
  await expect.poll(headerTop, { timeout: 3_000 }).toBeGreaterThanOrEqual(0)
  expect(await footerBottom()).toBeLessThanOrEqual(viewportHeight + 1)

  // 沉浸模式下没有分隔线（border-color 有 0.18s 过渡，轮询等它走完）
  await expect
    .poll(() => win.locator('header').evaluate((el) => getComputedStyle(el).borderBottomColor), {
      timeout: 3_000,
    })
    .toBe('rgba(0, 0, 0, 0)')

  await win.screenshot({ path: join(ARTIFACTS, 'reader-immersive.png') })

  // 单书字号：仅本书开启后，改字号只写 fontSizeByBook
  await win.getByRole('button', { name: /^20$/ }).first().click()
  await win.getByRole('button', { name: '仅本书' }).click()
  // 面板打开期间工具栏不会自动收起，直接点 A+
  await win.getByRole('button', { name: 'A+', exact: true }).click()

  const stored = await win.evaluate(() => JSON.parse(localStorage.getItem('reader.settings') ?? '{}'))
  expect(stored.fontSize).toBe(20)
  expect(Object.values(stored.fontSizeByBook ?? {})[0]).toBe(21)

  // 主题：切到深色后 <html data-theme> 与底色谱都要变
  await win.getByRole('button', { name: '设置' }).click()
  await expect(win.getByRole('heading', { name: '设置' })).toBeVisible()
  const background = () => win.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const lightBg = await background()

  await win.getByRole('button', { name: /^深色/ }).click()
  await expect
    .poll(() => win.evaluate(() => document.documentElement.dataset.theme))
    .toBe('dark')
  // body 有 0.2s 背景过渡，轮询等它落到深色
  await expect.poll(background, { timeout: 3_000 }).not.toBe(lightBg)

  await win.getByRole('button', { name: /^护眼/ }).click()
  await expect
    .poll(() => win.evaluate(() => document.documentElement.dataset.theme))
    .toBe('eye-care')

  // body 有过场动画，等它落定再截图，否则会拍到半透明的中间态
  await win.waitForTimeout(300)
  await win.screenshot({ path: join(ARTIFACTS, 'settings-theme.png') })

  // 护眼主题下的阅读页（顺带验证主题变量在正文里生效）
  await win.getByRole('button', { name: '返回书架' }).click()
  await expect(win.getByRole('heading', { name: '书架' })).toBeVisible()
  await win.screenshot({ path: join(ARTIFACTS, 'shelf-eye-care.png') })
  await win.locator('article').first().click()
  await expect(win.getByRole('heading', { name: '第 1 节' })).toBeVisible({ timeout: 30_000 })
  await win.screenshot({ path: join(ARTIFACTS, 'reader-eye-care.png') })

  // 再切到深色，确认书架与阅读页在深色下都能正常分色
  await win.getByRole('button', { name: '设置' }).click()
  await win.getByRole('button', { name: /^深色/ }).click()
  await expect
    .poll(() => win.evaluate(() => document.documentElement.dataset.theme))
    .toBe('dark')
  await win.waitForTimeout(300)
  await win.getByRole('button', { name: '返回书架' }).click()
  await expect(win.getByRole('heading', { name: '书架' })).toBeVisible()
  await win.screenshot({ path: join(ARTIFACTS, 'shelf-dark.png') })

  await win.locator('article').first().click()
  await expect(win.getByRole('heading', { name: '第 1 节' })).toBeVisible({ timeout: 30_000 })
  await win.screenshot({ path: join(ARTIFACTS, 'reader-dark.png') })

  await app.close()
})

test('v0.2：自动隐藏工具栏与章末翻章', async () => {
  const userData = join(ARTIFACTS, 'userdata-chapter-nav')
  const { app, win } = await launch(userData)

  const headerTop = () => win.locator('header').evaluate((el) => el.getBoundingClientRect().top)
  const chapterLabel = () => win.locator('header').innerText()
  const scrollToBottom = () =>
    win.evaluate(() => {
      const main = document.querySelector('main')
      if (main) main.scrollTop = main.scrollHeight
    })

  // 先在设置里打开：沉浸 + 自动隐藏工具栏 + 章末滚动翻章
  await win.getByRole('button', { name: '设置' }).click()
  await expect(win.getByRole('heading', { name: '设置' })).toBeVisible()
  await win.getByRole('button', { name: '无边框沉浸阅读' }).click()
  await win.getByRole('button', { name: '自动隐藏工具栏' }).click()
  await win.getByRole('button', { name: '章末继续滚动翻章' }).click()
  await win.getByRole('button', { name: '返回书架' }).click()

  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, LONG_SAMPLE)
  await win.getByRole('button', { name: '导入书籍' }).click()
  await expect(win.getByRole('heading', { name: '第 1 节' })).toBeVisible({ timeout: 30_000 })

  // 自动隐藏生效：工具栏滑出视口；移到顶部 24px 内浮出
  await expect.poll(headerTop, { timeout: 3_000 }).toBeLessThan(0)
  await win.mouse.move(600, 4)
  await expect.poll(headerTop, { timeout: 3_000 }).toBeGreaterThanOrEqual(0)

  // 章末有就地导航块，点击即可翻章（不需要碰工具栏）
  await scrollToBottom()
  const nav = win.getByRole('navigation', { name: '章节导航' })
  await expect(nav).toBeVisible()
  await expect(nav).toContainText('下一章')
  await win.mouse.move(800, 500)
  await win.screenshot({ path: join(ARTIFACTS, 'reader-chapter-nav.png') })
  await nav.getByRole('button', { name: /下一章/ }).click()
  await expect.poll(chapterLabel, { timeout: 5_000 }).toContain('2 / 3')

  // 章末继续向下滚动自动翻章（阈值 120px）
  await scrollToBottom()
  await win.mouse.move(800, 500)
  await win.mouse.wheel(0, 200)
  await expect.poll(chapterLabel, { timeout: 5_000 }).toContain('3 / 3')

  await win.screenshot({ path: join(ARTIFACTS, 'reader-auto-next.png') })
  await app.close()
})
