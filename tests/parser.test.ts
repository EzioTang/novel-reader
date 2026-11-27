import { describe, expect, it } from 'vitest'
import { guessMetadata, parseFileName, parseTxt } from '../src/parsers/txt'

describe('文件名元数据解析', () => {
  it('拆解「书名⊙作者⊙至第N章」', () => {
    expect(parseFileName('示例之书⊙某位作者⊙至第1234章.txt')).toEqual({
      title: '示例之书',
      author: '某位作者',
    })
  })

  it('拆解「书名 - 作者」', () => {
    expect(parseFileName('示例之书 - 某位作者.txt')).toEqual({
      title: '示例之书',
      author: '某位作者',
    })
  })

  it('去掉书名号与进度尾巴', () => {
    expect(parseFileName('《示例之书》至第88章.txt').title).toBe('示例之书')
  })

  it('没有作者信息时只返回书名', () => {
    const parsed = parseFileName('普通书名.txt')
    expect(parsed.title).toBe('普通书名')
    expect(parsed.author).toBeUndefined()
  })
})

describe('正文元数据推测', () => {
  it('文件名优先，不会被首行的栏目标记带偏', () => {
    const meta = guessMetadata('示例之书.txt', '【内容简介】\n这是一段简介。')
    expect(meta.title).toBe('示例之书')
  })

  it('首行是《书名》时以首行为准', () => {
    const meta = guessMetadata('02-示例.txt', '《风起长林》\n第一章 起')
    expect(meta.title).toBe('风起长林')
  })

  it('从正文里识别作者标记', () => {
    const meta = guessMetadata('示例.txt', '第一章 起\n\n作者：某位作者\n正文。')
    expect(meta.author).toBe('某位作者')
  })

  it('文件名无意义时退回首行短标题', () => {
    const meta = guessMetadata('1.txt', '无名故事\n第一章 起')
    expect(meta.title).toBe('无名故事')
  })
})

describe('parseTxt', () => {
  it('归一化并统计去空白字数', () => {
    const parsed = parseTxt('第一章 起\r\n\r\n正文 内容\r\n', '示例之书.txt')
    expect(parsed.text).toBe('第一章 起\n\n正文 内容')
    expect(parsed.charCount).toBe('第一章起正文内容'.length)
  })
})
