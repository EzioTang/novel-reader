# 小说阅读器（novel-reader）

桌面端本地 TXT 阅读器：**导入本地书 → 自动识别章节 → 沉浸式阅读（主题 / 排版 / 字号可调）**。

- 形态：Electron 33 + React 18 + TypeScript 5 + Vite 5（electron-vite）
- 当前版本：v0.2.0（阅读体验包已交付；M5 打包顺延）
- 文档：[开发框架.md](开发框架.md)（设计）· [开发日志.md](开发日志.md)（过程）· [版本说明.md](版本说明.md)（各版本功能）· [docs/v0.2-开发评估.md](docs/v0.2-开发评估.md)（v0.2 取舍与实测）

## 快速开始

**最简单：双击 `启动开发模式.cmd`（热更新）或 `启动应用.cmd`（运行已构建版本）。**

命令行方式（只依赖 `node`，不依赖 npm / pnpm）：

```bash
node scripts/run.mjs dev        # 开发模式：起窗口 + 热更新
node scripts/run.mjs preview    # 运行已构建版本（缺产物时会先提示 build）
node scripts/run.mjs build      # 三端产物 → out/
node scripts/run.mjs test       # Vitest 单元测试
node scripts/run.mjs e2e        # Playwright 驱动真实 Electron 的全链路测试
node scripts/run.mjs typecheck  # tsc --noEmit
node scripts/run.mjs lint       # ESLint
node scripts/run.mjs verify     # typecheck + lint + test + build
```

> 为什么多了 `scripts/run.mjs`：本机 PowerShell 执行策略禁用了 `npm.ps1`（`npm` 直接跑会报"禁止运行脚本"），
> `pnpm` 也没在 PATH 里。`run.mjs` 直接调用各工具入口，并顺手剔除 `ELECTRON_RUN_AS_NODE`，两条路都不踩坑。

若你的环境 npm 可用，等价的 `npm.cmd run dev|start|build|test|test:e2e|lint|verify` 也能用
（注意是 `npm.cmd`，不是 `npm`）。重装依赖用 `pnpm install`。

> 注意：如果终端里存在 `ELECTRON_RUN_AS_NODE=1`（某些工具链会注入），electron.exe 会退化成纯 Node，
> 报 `bad option: --remote-debugging-port` 且 `electron.app` 为 undefined。跑 `pnpm dev` / E2E 前先 `unset` 掉。

## 目录

```text
小说阅读器/
├─ 开发框架.md / 开发日志.md
├─ docs/                识别规则说明
├─ electron/
│  ├─ main/             窗口、菜单、IPC handler、文件与路径校验
│  └─ preload/          contextBridge 暴露 window.api
├─ src/
│  ├─ core/             领域模型、文本归一化、章节识别、字号规则（平台无关）
│  ├─ parsers/          TXT 解析与元数据推测
│  ├─ storage/          IndexedDB 仓储（书籍/正文/章节/进度）+ localStorage 设置
│  ├─ modules/          界面：importer / recognizer / bookshelf / reader / settings
│  ├─ stores/           Zustand
│  ├─ workers/          章节识别 Web Worker
│  └─ ui/ styles/       图标与全局样式
├─ shared/              IPC 契约、编码探测（主/渲染共用）
├─ tests/               Vitest（含样例库与真实书库验收）
├─ e2e/                 Playwright Electron 冒烟 + 全链路
├─ scripts/             样例书库生成
├─ resources/samples/   10 本合成样例 + manifest.json
├─ .npmrc / pnpm-workspace.yaml   依赖商店与镜像（全部留在本目录）
└─ package.json / tsconfig.json / electron.vite.config.ts / vitest.config.ts / playwright.config.ts
```

## 数据与环境落点

| 内容 | 位置 |
| --- | --- |
| 依赖 | `node_modules/`、`.pnpm-store/`（pnpm 商店，项目内） |
| Electron 二进制缓存 | `.electron-cache/`（`electron_config_cache`） |
| 构建产物 | `out/` |
| 书籍正文 / 章节 / 进度 | 本机 IndexedDB（Electron userData） |
| 字号等阅读设置 | localStorage |
| 测试产物（截图、trace） | `test-results/` |

`.npmrc` 里配置了 npmmirror 镜像（Electron 二进制、electron-builder 资源）与 npm 源，
`pnpm-workspace.yaml` 里配置了 `storeDir` 与 `allowBuilds`。整个目录可以直接搬走或删除。

## 能力（v0.2.0）

1. **TXT 导入**：编码探测（BOM → 严格 UTF-8 → GB18030 → 用户选择，带前 200 字预览），元数据推测（书名/作者/字数）
2. **章节识别**：规则库 + 打分 + 降级链，Web Worker 内执行；校正界面支持重命名/合并/拆分/删除/重跑
3. **阅读**：纵向滚动、目录侧栏（虚拟滚动，3873 章也不卡）、进度记忆（书籍+章节+字符偏移）
4. **无边框沉浸阅读**：隐藏工具栏/底栏/全部分隔线，鼠标到顶部浮出工具栏，可选全屏
5. **主题**：浅色 / 深色 / 护眼 / 跟随系统，同时作用于书架与阅读页
6. **排版**：4 种字体族、行距 1.2–3.0 倍（可自动随字号）、段距 0–2em、页边距 8–96px
7. **字号**：12–48px，工具栏 A−/A+、快捷键、Ctrl+滚轮、滑块与 12 档预设；支持「仅本书」覆盖；重排时按字符偏移保持阅读位置

## 不做什么（v0.2 仍未包含）

在线书源、账号与云同步、批注笔记、TTS、EPUB/PDF/MOBI、合集分书、横向分页。

## 测试数据

- `resources/samples/`：10 种排版风格的合成样例（程序生成，无版权风险），用于切章回归
- 真实书库验收：把任意一本大 TXT 放到项目根目录并命名为 `local-book.txt`（已在 `.gitignore` 中），
  或设置环境变量 `REAL_BOOK_PATH=<绝对路径>`，`pnpm test` 会额外跑一项大书实测（文件不存在则自动跳过）。
