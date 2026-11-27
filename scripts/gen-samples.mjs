/**
 * 生成合成样例书库（M2 验收用）。全部为程序生成的原创文本，无版权风险。
 * 输出：resources/samples/*.txt + manifest.json（每个样例的预期章节标题）。
 * 运行：node scripts/gen-samples.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'resources', 'samples')
mkdirSync(outDir, { recursive: true })

const FILLER = [
  '风从山口那边卷过来，带着一点潮气，也带着松木的味道。',
  '他停在石阶上，把手里的灯往下压了压，怕光晃着别人。',
  '夜里的小镇安静得很，只有水声，一下一下，像是有人在数着什么。',
  '她说的话他一直记着：路要一段一段走，急不得。',
  '远处的钟敲了九下，钟声散开去，落进每一扇亮着的窗。',
  '茶碗里的热气慢慢淡了，他这才想起自己已经坐了很久。',
]

function paragraph(seed, count = 3) {
  const out = []
  for (let i = 0; i < count; i++) out.push(FILLER[(seed + i) % FILLER.length])
  return out.join('')
}

function chapter(title, seed, paraCount = 3) {
  return `${title}\n\n${paragraph(seed, paraCount)}\n`
}

const SAMPLES = []

function emit(name, content, meta) {
  writeFileSync(join(outDir, name), content, 'utf8')
  SAMPLES.push({ file: name, ...meta })
}

// 1. 标准「第X章」
{
  const headings = []
  let body = '山雨欲来\n\n' + paragraph(0) + '\n\n'
  for (let i = 1; i <= 8; i++) {
    const title = `第${['一', '二', '三', '四', '五', '六', '七', '八'][i - 1]}章 风起${i}`
    headings.push(title)
    body += chapter(title, i, 4)
  }
  emit('01-standard-chapter.txt', body, { style: '标准 第X章', headings })
}

// 2. 卷 + 章两级（章号全局连续，避免歧义）
{
  const volumeHeadings = ['第一卷 山雨', '第二卷 长夜', '第三卷 归途']
  const headings = []
  let body = ''
  let n = 0
  const cn = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
  for (let v = 0; v < 3; v++) {
    body += `${volumeHeadings[v]}\n\n${paragraph(v)}\n`
    for (let c = 0; c < 3; c++) {
      n += 1
      const title = `第${cn[n - 1]}章 ${['起', '承', '转', '合', '别', '归', '望', '渡', '尽'][n - 1]}`
      headings.push(title)
      body += chapter(title, n, 3)
    }
  }
  emit('02-volume-chapter.txt', body, { style: '卷+章两级', headings, volumes: volumeHeadings })
}

// 3. 英文 Chapter
{
  const headings = []
  let body = ''
  for (let i = 1; i <= 6; i++) {
    const title = `Chapter ${i} The Long Way`
    headings.push(title)
    body += chapter(title, i, 3)
  }
  emit('03-english-chapter.txt', body, { style: '英文 Chapter', headings })
}

// 4. 数字标题
{
  const headings = []
  let body = ''
  for (let i = 1; i <= 7; i++) {
    const title = `${i}、第${i}次远行`
    headings.push(title)
    body += chapter(title, i, 3)
  }
  emit('04-numeric-title.txt', body, { style: '数字标题', headings })
}

// 5. 特殊标题
{
  const headings = ['序章', '楔子', '第一章 入山', '第二章 遇雨', '第三章 出山', '尾声', '番外']
  let body = ''
  headings.forEach((title, i) => {
    body += chapter(title, i, 4)
  })
  emit('05-special-title.txt', body, { style: '序章/尾声/番外', headings })
}

// 6. 装饰符号标题（★、【】）
{
  const headings = []
  let body = ''
  for (let i = 1; i <= 6; i++) {
    const plain = `第${['一', '二', '三', '四', '五', '六'][i - 1]}章 灯下`
    const decorated = i % 2 === 0 ? `【${plain}】` : `★ ${plain}`
    // 展示用标题保留装饰，识别后应剥离
    headings.push(plain)
    body += chapter(decorated, i, 3)
  }
  emit('06-decorated.txt', body, { style: '带装饰符号标题', headings })
}

// 7. 无任何标题的裸文本（应降级为按字数切分）
{
  let body = ''
  for (let i = 0; i < 90; i++) body += paragraph(i, 3) + '\n\n'
  emit('07-no-heading.txt', body, { style: '无标题裸文本', headings: [], expectStrategy: 'char-count' })
}

// 8. 空行短行（应降级为空行分段）
{
  const headings = ['雨夜', '旧信', '长街', '归人']
  let body = '　　这是一段没有任何章节编号的旧稿。\n\n'
  headings.forEach((title, i) => {
    body += `${title}\n\n${paragraph(i, 2)}\n\n`
  })
  emit('08-blank-line.txt', body, {
    style: '空行短行',
    headings,
    expectStrategy: 'blank-line',
  })
}

// 9. 全角空格缩进的章节标题
{
  const headings = []
  let body = ''
  for (let i = 1; i <= 5; i++) {
    const title = `第${['一', '二', '三', '四', '五'][i - 1]}章 缩进`
    headings.push(title)
    // 用 \u3000 表示全角空格，避免源码里出现不规则空白
    body += `\u3000\u3000${title}\n\n${paragraph(i, 3)}\n`
  }
  emit('09-indented.txt', body, { style: '全角缩进标题', headings })
}

// 10. 中文数字与阿拉伯数字混排
{
  const headings = []
  let body = ''
  const names = ['第一章 混排一', '第2章 混排二', '第三章 混排三', '第4章 混排四', '第五章 混排五']
  names.forEach((title, i) => {
    headings.push(title)
    body += chapter(title, i, 3)
  })
  emit('10-mixed-numeral.txt', body, { style: '中文数字/阿拉伯数字混排', headings })
}

writeFileSync(
  join(outDir, 'manifest.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), samples: SAMPLES }, null, 2),
  'utf8',
)

console.log(`已生成 ${SAMPLES.length} 个样例 → ${outDir}`)
for (const s of SAMPLES) console.log(` - ${s.file}  (${s.style}, 预期 ${s.headings.length} 章)`)
