import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FONT_SIZE } from '../../core/types'
import { canDecrease, canIncrease, stepFontSize } from '../../core/settings/fontSize'
import {
  FONT_FAMILIES,
  LINE_HEIGHT,
  PAGE_MARGIN,
  PARAGRAPH_SPACING,
  resolveFontStack,
} from '../../core/settings/typography'
import { THEME_OPTIONS, THEME_SWATCH } from '../../core/theme'
import { useSettingsStore } from '../../stores/settingsStore'
import { BackIcon } from '../../ui/icons'
import styles from './SettingsPage.module.css'

export function SettingsPage(): JSX.Element {
  const navigate = useNavigate()
  const settings = useSettingsStore((s) => s.settings)
  const setFontSize = useSettingsStore((s) => s.setFontSize)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const setFontFamily = useSettingsStore((s) => s.setFontFamily)
  const setLineHeight = useSettingsStore((s) => s.setLineHeight)
  const setParagraphSpacing = useSettingsStore((s) => s.setParagraphSpacing)
  const setPageMargin = useSettingsStore((s) => s.setPageMargin)
  const setImmersive = useSettingsStore((s) => s.setImmersive)
  const setImmersiveAutoHide = useSettingsStore((s) => s.setImmersiveAutoHide)
  const setAutoNextChapter = useSettingsStore((s) => s.setAutoNextChapter)
  const [version, setVersion] = useState('')

  useEffect(() => {
    void window.api.app.getVersion().then(setVersion)
  }, [])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className="btn btn-ghost" onClick={() => navigate('/')} title="返回书架">
          <BackIcon />
        </button>
        <h1>设置</h1>
      </header>

      <main className={styles.main}>
        <section className={styles.card}>
          <h2>外观</h2>
          <p className={styles.desc}>主题会同时作用于书架与阅读页，选择「跟随系统」时随系统深浅色自动切换。</p>
          <div className={styles.themes}>
            {THEME_OPTIONS.map((option) => {
              const swatch = THEME_SWATCH[option.value === 'system' ? 'light' : option.value]
              return (
                <button
                  key={option.value}
                  className={`${styles.themeOption} ${settings.theme === option.value ? styles.themeActive : ''}`}
                  onClick={() => setTheme(option.value)}
                  aria-pressed={settings.theme === option.value}
                  aria-label={option.label}
                  title={option.hint}
                >
                  <span
                    className={styles.swatch}
                    style={{ background: swatch.bg, color: swatch.fg, borderColor: swatch.accent }}
                  >
                    A
                  </span>
                  <span className={styles.themeLabel}>{option.label}</span>
                  <span className={styles.themeHint}>{option.hint}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className={styles.card}>
          <h2>阅读排版</h2>
          <p className={styles.desc}>
            这些是全局默认值；在阅读页里还可用 <kbd>A−</kbd> / <kbd>A+</kbd>、<kbd>Ctrl + =</kbd> /
            <kbd>Ctrl + −</kbd>、<kbd>Ctrl + 滚轮</kbd> 即时调整。单本书的独立字号在阅读页的排版面板里打开「仅本书」。
          </p>

          <div className={styles.previewWrap}>
            <div
              className={styles.preview}
              style={{
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
                fontFamily: resolveFontStack(settings.fontFamily),
                paddingInline: `${settings.pageMargin}px`,
              }}
            >
              <p style={{ marginBottom: `${settings.paragraphSpacing}em` }}>
                山色空蒙雨亦奇，卷中天地自宽。这一段用来预览字号、字体、行距、段距与页边距的实际效果。
              </p>
              <p style={{ margin: 0 }}>字号 {settings.fontSize}px · 行距 {settings.lineHeight.toFixed(2)} 倍</p>
            </div>
          </div>

          <div className={styles.controlRow}>
            <button
              className="btn"
              onClick={() => setFontSize(stepFontSize(settings.fontSize, 'decrease'))}
              disabled={!canDecrease(settings.fontSize)}
            >
              A−
            </button>
            <input
              className={styles.slider}
              type="range"
              min={FONT_SIZE.min}
              max={FONT_SIZE.max}
              step={FONT_SIZE.step}
              value={settings.fontSize}
              onChange={(event) => setFontSize(Number(event.target.value))}
              aria-label="字号"
            />
            <button
              className="btn"
              onClick={() => setFontSize(stepFontSize(settings.fontSize, 'increase'))}
              disabled={!canIncrease(settings.fontSize)}
            >
              A+
            </button>
            <span className={styles.value}>{settings.fontSize}px</span>
          </div>

          <div className={styles.presets}>
            {FONT_SIZE.presets.map((preset) => (
              <button
                key={preset}
                className={`${styles.preset} ${preset === settings.fontSize ? styles.presetActive : ''}`}
                onClick={() => setFontSize(preset)}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>字体</span>
            <div className={styles.chips}>
              {FONT_FAMILIES.map((family) => (
                <button
                  key={family.value}
                  className={`${styles.chip} ${settings.fontFamily === family.value ? styles.chipActive : ''}`}
                  onClick={() => setFontFamily(family.value)}
                  aria-pressed={settings.fontFamily === family.value}
                >
                  {family.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>行距</span>
            <input
              className={styles.slider}
              type="range"
              min={LINE_HEIGHT.min}
              max={LINE_HEIGHT.max}
              step={LINE_HEIGHT.step}
              value={settings.lineHeight}
              onChange={(event) => setLineHeight(Number(event.target.value))}
              aria-label="行距"
            />
            <span className={styles.value}>{settings.lineHeight.toFixed(2)}</span>
            <button
              className={`${styles.chip} ${settings.lineHeightAuto ? styles.chipActive : ''}`}
              onClick={() => setLineHeight(settings.lineHeight, true)}
              title="行距随字号自动派生"
            >
              自动
            </button>
          </div>

          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>段距</span>
            <input
              className={styles.slider}
              type="range"
              min={PARAGRAPH_SPACING.min}
              max={PARAGRAPH_SPACING.max}
              step={PARAGRAPH_SPACING.step}
              value={settings.paragraphSpacing}
              onChange={(event) => setParagraphSpacing(Number(event.target.value))}
              aria-label="段间距"
            />
            <span className={styles.value}>{settings.paragraphSpacing.toFixed(1)}em</span>
          </div>

          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>页边距</span>
            <input
              className={styles.slider}
              type="range"
              min={PAGE_MARGIN.min}
              max={PAGE_MARGIN.max}
              step={PAGE_MARGIN.step}
              value={settings.pageMargin}
              onChange={(event) => setPageMargin(Number(event.target.value))}
              aria-label="页边距"
            />
            <span className={styles.value}>{settings.pageMargin}px</span>
          </div>
        </section>

        <section className={styles.card}>
          <h2>无边框阅读</h2>
          <p className={styles.desc}>
            阅读时去掉顶部工具栏、底部进度条与所有分隔线的描边，正文铺满窗口。
            默认保留工具栏与底栏（仍然无边框），章末还有就地翻章入口；想要更极简可以单独打开「自动隐藏工具栏」。
          </p>
          <div className={styles.toggleRow}>
            <div>
              <div className={styles.toggleTitle}>无边框沉浸阅读</div>
              <div className={styles.toggleHint}>只影响阅读页，书架与设置页保持原样</div>
            </div>
            <button
              className={`${styles.switch} ${settings.immersiveReading ? styles.switchOn : ''}`}
              onClick={() => setImmersive(!settings.immersiveReading)}
              aria-pressed={settings.immersiveReading}
              aria-label="无边框沉浸阅读"
            >
              <span className={styles.knob} />
            </button>
          </div>
          <div className={styles.toggleRow}>
            <div>
              <div className={styles.toggleTitle}>自动隐藏工具栏</div>
              <div className={styles.toggleHint}>
                {settings.immersiveReading
                  ? '鼠标进入窗口顶部 24px 时浮出，离开后 1.6 秒收起；默认关闭，工具栏常驻'
                  : '仅在无边框模式下生效'}
              </div>
            </div>
            <button
              className={`${styles.switch} ${settings.immersiveAutoHide ? styles.switchOn : ''}`}
              onClick={() => setImmersiveAutoHide(!settings.immersiveAutoHide)}
              aria-pressed={settings.immersiveAutoHide}
              aria-label="自动隐藏工具栏"
              disabled={!settings.immersiveReading}
            >
              <span className={styles.knob} />
            </button>
          </div>
          <div className={styles.toggleRow}>
            <div>
              <div className={styles.toggleTitle}>章末继续滚动翻章</div>
              <div className={styles.toggleHint}>
                读到章末后继续向下滚动（约两下滚轮）自动进入下一章，顶部反向同理；
                仅当本章内容超出一屏时生效
              </div>
            </div>
            <button
              className={`${styles.switch} ${settings.autoNextChapter ? styles.switchOn : ''}`}
              onClick={() => setAutoNextChapter(!settings.autoNextChapter)}
              aria-pressed={settings.autoNextChapter}
              aria-label="章末继续滚动翻章"
            >
              <span className={styles.knob} />
            </button>
          </div>
          <dl className={styles.facts}>
            <div>
              <dt>章末翻章</dt>
              <dd>正文末尾有 [上一章][目录][下一章] 导航块；也可用 <kbd>←</kbd> <kbd>→</kbd> 方向键</dd>
            </div>
            <div>
              <dt>全屏</dt>
              <dd>阅读页工具栏的全屏按钮，或 <kbd>F11</kbd>；<kbd>Esc</kbd> 退出全屏</dd>
            </div>
            <div>
              <dt>翻页方式</dt>
              <dd>纵向滚动（v0.2 仍为唯一模式，横向分页规划于 v0.2.2）</dd>
            </div>
          </dl>
        </section>

        <section className={styles.card}>
          <h2>关于</h2>
          <dl className={styles.facts}>
            <div>
              <dt>应用</dt>
              <dd>小说阅读器 v{version || '0.2.0'}</dd>
            </div>
            <div>
              <dt>能力范围</dt>
              <dd>TXT 导入 · 章节智能识别与人工校正 · 沉浸阅读 · 主题与排版 · 字号调节与进度记忆</dd>
            </div>
            <div>
              <dt>数据位置</dt>
              <dd>书籍与进度存本机 IndexedDB；主题、排版与字号存 localStorage；不联网</dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  )
}
