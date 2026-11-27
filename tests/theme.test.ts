import { describe, expect, it } from 'vitest'
import { THEME_OPTIONS, THEME_SWATCH, nativeThemeSource, resolveTheme } from '../src/core/theme'
import { DEFAULT_READER_SETTINGS } from '../src/core/types'
import { normalizeSettings } from '../src/core/settings/normalizeSettings'

describe('主题解析', () => {
  it('system 跟随系统深浅色', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('显式主题不受系统影响', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('eye-care', true)).toBe('eye-care')
  })

  it('四种模式都有名称、说明和预览色', () => {
    expect(THEME_OPTIONS).toHaveLength(4)
    for (const option of THEME_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0)
      expect(option.hint.length).toBeGreaterThan(0)
    }
    expect(THEME_SWATCH.dark.bg).not.toBe(THEME_SWATCH.light.bg)
    expect(THEME_SWATCH['eye-care'].bg).not.toBe(THEME_SWATCH.light.bg)
  })

  it('原生标题栏色调：护眼归到 light', () => {
    expect(nativeThemeSource('eye-care')).toBe('light')
    expect(nativeThemeSource('dark')).toBe('dark')
    expect(nativeThemeSource('system')).toBe('system')
  })
})

describe('设置迁移（v0.1.x → v0.2）', () => {
  it('旧版 fontFamily 存的是 CSS 值，迁移成默认字体 key', () => {
    const migrated = normalizeSettings({ fontFamily: 'system-ui', fontSize: 22 })
    expect(migrated.fontFamily).toBe('serif')
    expect(migrated.fontSize).toBe(22)
  })

  it('缺失的新字段用默认值补齐', () => {
    const migrated = normalizeSettings({ fontSize: 20 })
    expect(migrated.lineHeightAuto).toBe(DEFAULT_READER_SETTINGS.lineHeightAuto)
    expect(migrated.paragraphSpacing).toBe(DEFAULT_READER_SETTINGS.paragraphSpacing)
    expect(migrated.pageMargin).toBe(DEFAULT_READER_SETTINGS.pageMargin)
    expect(migrated.immersiveReading).toBe(false)
    // 沉浸默认只去边框：自动隐藏关闭、章末自动翻章关闭
    expect(migrated.immersiveAutoHide).toBe(false)
    expect(migrated.autoNextChapter).toBe(false)
  })

  it('旧的 immersiveAutoReveal 不再影响新行为（默认常驻工具栏）', () => {
    const migrated = normalizeSettings({ immersiveReading: true, immersiveAutoReveal: true })
    expect(migrated.immersiveAutoHide).toBe(false)
  })

  it('pageMode 恒为 scroll（横向分页未启用）', () => {
    expect(normalizeSettings({ pageMode: 'horizontal' }).pageMode).toBe('scroll')
  })

  it('非法数值被夹回合法区间，损坏对象回退全部默认', () => {
    const migrated = normalizeSettings({ fontSize: 999, lineHeight: -3, pageMargin: 9999 })
    expect(migrated.fontSize).toBe(48)
    expect(migrated.lineHeight).toBe(1.2)
    expect(migrated.pageMargin).toBe(96)

    expect(normalizeSettings(null).fontSize).toBe(DEFAULT_READER_SETTINGS.fontSize)
    expect(normalizeSettings('oops').fontSize).toBe(DEFAULT_READER_SETTINGS.fontSize)
  })

  it('单书字号表会过滤非法项并夹回区间', () => {
    const migrated = normalizeSettings({
      fontSizeByBook: { a: 26, b: 999, c: 'x', '': 20 },
    })
    expect(migrated.fontSizeByBook).toEqual({ a: 26, b: 48 })
  })
})
