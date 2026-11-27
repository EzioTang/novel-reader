import { defineConfig } from '@playwright/test'

// E2E 只覆盖「Electron 能启动 + 首屏渲染」的冒烟，不下载浏览器内核。
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
  },
})
