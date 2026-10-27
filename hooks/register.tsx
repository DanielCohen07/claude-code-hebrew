import { atom, read, update } from 'claude-code'
import type { Register, RenderNode } from 'claude-code'

import { dirOf, isHebrew, markRtl, parse, spans } from './markdown'
import type { Block, Span } from './markdown'

const isOn = atom({ plugin: 'hebrew-rtl', key: 'isOn' } as const, true)

const HEBREW_NOTE = [
  'The person reads this interface in Hebrew, right to left.',
  'When they write in Hebrew, answer in Hebrew.',
  'Inside Hebrew text, wrap English identifiers, file paths and commands in backticks so they keep their left-to-right order,',
  'and open each line, heading and list item with a Hebrew word where you can.',
].join(' ')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const stored = await $.store.get('isOn')
    if (typeof stored === 'boolean') {
      await update($, isOn, () => stored)
    }
    await $.command.register({
      name: 'rtl',
      description: 'Hebrew right-to-left drawing on or off',
    })

    return next(e)
  })

  on('command.run', { command: 'rtl' }, async $ => {
    const now = !(await read($, isOn))
    await update($, isOn, () => now)
    await $.store.set('isOn', now)

    return { text: now ? 'עברית מימין לשמאל: פועל' : 'עברית מימין לשמאל: כבוי' }
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const isQuiet = e.traits.includes('print') || e.traits.includes('bare')
    const isThere = composed.sections.some(one => one.id === 'hebrew-rtl:hebrew')
    if (isQuiet || isThere || !(await read($, isOn))) {
      return composed
    }

    return {
      sections: [
        ...composed.sections,
        { id: 'hebrew-rtl:hebrew', text: HEBREW_NOTE, scope: 'session' },
      ],
    }
  })

  // The desktop, VS Code and mobile pages draw the markdown themselves and
  // take each block's direction from its first strong letter: a tree of ours
  // there reorders it wrong, so they get the same text with a right-to-left
  // mark opening every block. The terminal, which orders the letters itself
  // for `dir`, is redrawn.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!(await read($, isOn)) || !isHebrew(e.props.text)) {
      return next(e)
    }
    if (e.surface !== 'terminal') {
      return next({ ...e, props: { ...e.props, text: markRtl(e.props.text) } })
    }
    const blocks = parse(e.props.text)
    if (blocks.length === 0) {
      return next(e)
    }
    const { Box, Code, Link, Text } = $.ui.resolve(e)
    const codeStyle = { color: 'permission' }

    const inline = (text: string): RenderNode[] =>
      spans(text).map((span: Span): RenderNode => {
        switch (span.kind) {
          case 'text':
            return span.text
          case 'code':
            return <Text {...codeStyle}>{span.text}</Text>
          case 'bold':
            return <Text weight="bold">{inline(span.text)}</Text>
          case 'italic':
            return <Text italic>{inline(span.text)}</Text>
          case 'strike':
            return <Text strikethrough>{inline(span.text)}</Text>
          case 'link':
            return <Link href={span.href}>{span.text}</Link>
        }
      })

    // A run of text, flush to the side it reads from.
    const line = (text: string, style: Record<string, string | boolean> = {}) => {
      const dir = dirOf(text)

      return (
        <Box
          flexDirection="column"
          flexGrow={1}
          flexShrink={1}
          alignItems={dir === 'rtl' ? 'flex-end' : 'flex-start'}
        >
          <Text dir={dir} {...style}>
            {text === '' ? ' ' : inline(text)}
          </Text>
        </Box>
      )
    }

    const draw = (block: Block): RenderNode => {
      switch (block.kind) {
        case 'code':
          return block.language === undefined ? (
            <Code source={block.source} />
          ) : (
            <Code source={block.source} language={block.language} />
          )
        case 'heading':
          return line(block.text, {
            weight: 'bold',
            size: block.level <= 2 ? 'heading' : 'body',
          })
        case 'rule':
          return (
            <Box flexDirection="column" alignItems="flex-end">
              <Text dimColor>{'─'.repeat(24)}</Text>
            </Box>
          )
        case 'quote':
          return (
            <Box flexDirection="row-reverse" gap={1}>
              <Text dimColor>▎</Text>
              {line(block.text, { dimColor: true })}
            </Box>
          )
        case 'list':
          return (
            <Box flexDirection="column">
              {block.items.map(item => (
                <Box
                  flexDirection="row-reverse"
                  gap={1}
                  paddingRight={item.depth * 2}
                >
                  <Text dir="rtl" dimColor={item.marker === '•'}>
                    {item.marker}
                  </Text>
                  {line(item.text)}
                </Box>
              ))}
            </Box>
          )
        case 'table': {
          const columns = Math.max(
            block.head.length,
            ...block.rows.map(row => row.length),
          )
          const width = `${Math.floor(100 / Math.max(1, columns))}%`
          const row = (cells: string[], weight: string) => (
            <Box flexDirection="row-reverse">
              {Array.from({ length: columns }, (_, column) => (
                <Box width={width} paddingX={1} flexDirection="column">
                  {line(cells[column] ?? '', { weight })}
                </Box>
              ))}
            </Box>
          )

          return (
            <Box flexDirection="column">
              {row(block.head, 'bold')}
              {block.rows.map(cells => row(cells, 'regular'))}
            </Box>
          )
        }
        case 'para':
          return line(block.text)
      }
    }

    return (
      <Box flexDirection="column" gap={1}>
        {blocks.map(draw)}
      </Box>
    )
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const isPrompt = e.surface === 'terminal' && e.props.origin.kind === 'composer'
    if (!isPrompt || !(await read($, isOn)) || !isHebrew(e.props.text)) {
      return next(e)
    }
    const { Box, Text } = $.ui.resolve(e)
    const rows = e.props.text.split('\n').map(text => {
      const dir = dirOf(text)

      return (
        <Box
          flexDirection="column"
          alignItems={dir === 'rtl' ? 'flex-end' : 'flex-start'}
        >
          <Text dir={dir}>{text === '' ? ' ' : text}</Text>
        </Box>
      )
    })

    return (
      <Box flexDirection="row-reverse" gap={1}>
        <Text dimColor>❮</Text>
        <Box flexDirection="column" flexGrow={1} flexShrink={1}>
          {rows}
        </Box>
      </Box>
    )
  })
}
