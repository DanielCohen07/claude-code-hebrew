// The markdown a reply is written in, split into the blocks and inline spans
// the mod draws itself. Plain functions: nothing here touches `$`.

export type Dir = 'rtl' | 'ltr'

export type Item = { depth: number; marker: string; text: string }

export type Block =
  | { kind: 'code'; source: string; language?: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'list'; items: Item[] }
  | { kind: 'quote'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'rule' }
  | { kind: 'para'; text: string }

export type Span =
  | { kind: 'text' | 'code' | 'bold' | 'italic' | 'strike'; text: string }
  | { kind: 'link'; text: string; href: string }

const HEBREW = /[\u0590-\u05FF\uFB1D-\uFB4F]/g
const LATIN = /[A-Za-z]/g

const count = (text: string, letters: RegExp) => text.match(letters)?.length ?? 0

// Prose only: code says nothing about which way a message reads.
const prose = (text: string) =>
  text
    .replace(/(```|~~~)[\s\S]*?(\1|$)/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')

export const isHebrew = (text: string) => {
  const words = prose(text)
  const hebrew = count(words, HEBREW)
  const latin = count(words, LATIN)

  return hebrew > 0 && hebrew >= (hebrew + latin) * 0.3
}

export const dirOf = (text: string): Dir =>
  count(text, HEBREW) > 0 || count(text, LATIN) === 0 ? 'rtl' : 'ltr'

const FENCE = /^\s*(`{3,}|~{3,})\s*([\w+#.-]*)/
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
const ITEM = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/
const QUOTE = /^\s{0,3}>\s?(.*)$/
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/
const DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim())

export const parse = (markdown: string): Block[] => {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const at = (n: number) => lines[n] ?? ''
  const blocks: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length > 0) {
      blocks.push({ kind: 'para', text: para.join('\n') })
    }
    para = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = at(i)
    const fence = FENCE.exec(line)
    if (fence) {
      flush()
      const opener = fence[1] ?? '```'
      const mark = opener.startsWith('`') ? '`' : '~'
      const close = new RegExp(`^\\s*${mark}{${opener.length},}\\s*$`)
      const body: string[] = []
      i++
      while (i < lines.length && !close.test(at(i))) {
        body.push(at(i++))
      }
      blocks.push(
        fence[2]
          ? { kind: 'code', source: body.join('\n'), language: fence[2] }
          : { kind: 'code', source: body.join('\n') },
      )
      continue
    }
    if (line.trim() === '') {
      flush()
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      flush()
      blocks.push({
        kind: 'heading',
        level: (heading[1] ?? '#').length,
        text: heading[2] ?? '',
      })
      continue
    }
    if (RULE.test(line)) {
      flush()
      blocks.push({ kind: 'rule' })
      continue
    }
    const below = at(i + 1)
    if (line.includes('|') && below.includes('|') && DIVIDER.test(below)) {
      flush()
      const head = cells(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && at(i).includes('|') && at(i).trim() !== '') {
        rows.push(cells(at(i++)))
      }
      i--
      blocks.push({ kind: 'table', head, rows })
      continue
    }
    const quote = QUOTE.exec(line)
    if (quote) {
      flush()
      const body = [quote[1] ?? '']
      while (i + 1 < lines.length && QUOTE.test(at(i + 1))) {
        body.push(QUOTE.exec(at(++i))?.[1] ?? '')
      }
      blocks.push({ kind: 'quote', text: body.join(' ').trim() })
      continue
    }
    if (ITEM.test(line)) {
      flush()
      const items: Item[] = []
      const indents: number[] = []
      const deepest = () => indents[indents.length - 1] ?? -1
      let j = i
      while (j < lines.length) {
        const item = ITEM.exec(at(j))
        if (item) {
          const indent = (item[1] ?? '').replace(/\t/g, '    ').length
          while (indents.length > 0 && indent < deepest()) {
            indents.pop()
          }
          if (indent > deepest()) {
            indents.push(indent)
          }
          const marker = item[2] ?? '-'
          items.push({
            depth: indents.length - 1,
            marker: /\d/.test(marker) ? marker.replace(')', '.') : '•',
            text: item[3] ?? '',
          })
          j++
          continue
        }
        const isGap = at(j).trim() === '' && ITEM.test(at(j + 1))
        if (isGap) {
          j++
          continue
        }
        const last = items[items.length - 1]
        const isMore = /^\s+\S/.test(at(j)) && !FENCE.test(at(j))
        if (isMore && last !== undefined) {
          last.text += ` ${at(j).trim()}`
          j++
          continue
        }
        break
      }
      i = j - 1
      blocks.push({ kind: 'list', items })
      continue
    }
    para.push(line.trim())
  }
  flush()

  return blocks
}

const INLINE = new RegExp(
  [
    '(`+)([^`]|[^`][\\s\\S]*?[^`])\\1(?!`)',
    '\\*\\*(?=\\S)([\\s\\S]*?\\S)\\*\\*',
    '__(?=\\S)([\\s\\S]*?\\S)__',
    '~~(?=\\S)([\\s\\S]*?\\S)~~',
    '\\[([^\\]\\n]+)\\]\\(<?([^)\\s>]+)>?(?:\\s+"[^"]*")?\\)',
    '(?<![\\w*])\\*(?=[^\\s*])([^*\\n]*?[^\\s*])\\*(?![\\w*])',
    '(?<![\\w_])_(?=[^\\s_])([^_\\n]*?[^\\s_])_(?![\\w_])',
    '<(https?://[^>\\s]+)>',
    '(https?://[^\\s<>()]*[^\\s<>().,;:!?\'"\\]])',
  ].join('|'),
  'g',
)

const unescape = (text: string) => text.replace(/\\([\\`*_{}[\]()#+\-.!|~>])/g, '$1')

export const spans = (text: string): Span[] => {
  const out: Span[] = []
  let from = 0
  for (const match of text.matchAll(INLINE)) {
    const at = match.index ?? 0
    if (at > from) {
      out.push({ kind: 'text', text: unescape(text.slice(from, at)) })
    }
    const [, , code, bold, boldToo, strike, label, href, star, under, angle, bare] =
      match
    if (code !== undefined) {
      out.push({ kind: 'code', text: code.trim() === '' ? code : code.replace(/^ (.*) $/, '$1') })
    } else if (bold !== undefined || boldToo !== undefined) {
      out.push({ kind: 'bold', text: bold ?? boldToo ?? '' })
    } else if (strike !== undefined) {
      out.push({ kind: 'strike', text: strike })
    } else if (label !== undefined && href !== undefined) {
      out.push({ kind: 'link', text: unescape(label), href })
    } else if (star !== undefined || under !== undefined) {
      out.push({ kind: 'italic', text: star ?? under ?? '' })
    } else {
      const url = angle ?? bare ?? match[0]
      out.push({ kind: 'link', text: url, href: url })
    }
    from = at + match[0].length
  }
  if (from < text.length) {
    out.push({ kind: 'text', text: unescape(text.slice(from)) })
  }

  return out
}

// The desktop page sets each block's direction from its first strong letter,
// so a list or paragraph that opens with an English word reads left to right.
// A right-to-left mark opening every line outside code sets it right to left;
// the page still draws the markdown itself.
export const RLM = '\u200F'

const OPENER = /^(\s*(?:>\s?)*\s*(?:#{1,6}\s+|(?:[-*+]|\d{1,3}[.)])\s+(?:\[[ xX]\]\s+)?)?)(.*)$/

export const markRtl = (markdown: string) => {
  let close: RegExp | null = null

  return markdown
    .split('\n')
    .map(line => {
      if (close !== null) {
        if (close.test(line)) {
          close = null
        }

        return line
      }
      const fence = FENCE.exec(line)
      if (fence) {
        const opener = fence[1] ?? '```'
        const mark = opener.startsWith('`') ? '`' : '~'
        close = new RegExp(`^\\s*${mark}{${opener.length},}\\s*$`)

        return line
      }
      if (line.trim() === '' || RULE.test(line) || DIVIDER.test(line)) {
        return line
      }
      if (line.trimStart().startsWith('|')) {
        return line.replace(/\|(\s*)(?=[^|\s\u200F])/g, `|$1${RLM}`)
      }
      const [, lead = '', rest = ''] = OPENER.exec(line) ?? []

      return rest === '' || rest.startsWith(RLM) ? line : `${lead}${RLM}${rest}`
    })
    .join('\n')
}
