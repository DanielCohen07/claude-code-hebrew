import { expect, test } from 'claude-code/testing'

import { RLM, dirOf, isHebrew, markRtl, parse, spans } from '../hooks/markdown'

const REPLY = [
  '## סיכום',
  '',
  'הקובץ `register.tsx` נכתב, ו-**הבדיקות** עברו. ראו [המדריך](https://code.claude.com).',
  '',
  '- פריט ראשון',
  '  - פריט מקונן',
  '1. שלב אחד',
  '',
  '| שם | ערך |',
  '|---|---|',
  '| פונט | Assistant |',
  '',
  '```bash',
  'claude plugin validate .',
  '```',
].join('\n')

const PROMPT = {
  plugin: 'hebrew-rtl',
  component: 'UserMessage',
  requestId: 'u1',
  props: {
    text: 'תוסיף Assistant לכל האפליקציה',
    origin: { kind: 'composer' },
    isExpanded: false,
  },
} as const

const message = (text: string) =>
  ({
    plugin: 'hebrew-rtl',
    component: 'AssistantMessage',
    requestId: 'm1',
    props: { text, isFirstOfReply: true },
  }) as const

test('a Hebrew reply reads right to left on the terminal, its code left to right', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  {
    const ui = await $.ui.mount({ ...message(REPLY), surface: 'terminal' })

    expect(await ui.find({ type: 'Text', text: /engine/ })).toBeUndefined()
    const heading = await ui.find({ type: 'Text', text: /סיכום/ })
    expect(heading?.props.dir).toBe('rtl')
    expect(heading?.props.weight).toBe('bold')
    const nested = await ui.find({ type: 'Text', text: /פריט מקונן/ })
    expect(nested?.props.dir).toBe('rtl')
    const cell = await ui.find({ type: 'Text', text: /^Assistant$/ })
    expect(cell?.props.dir).toBe('ltr')
    const code = await ui.find({ type: 'Code' })
    expect(code?.props.source).toBe('claude plugin validate .')
    expect(code?.props.language).toBe('bash')
    expect(await ui.find({ type: 'Link' })).toBeDefined()
    await ui.unmount()
  }
})

test('the desktop, VS Code and mobile pages draw it themselves, each block marked right to left', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{'text' in e.props ? String(e.props.text) : 'engine'}</Text>
  })

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const reply = await $.ui.mount({ ...message(REPLY), surface })
    const drawn = (await reply.find({ type: 'Text' }))?.text ?? ''
    expect(drawn).toBe(markRtl(REPLY))
    expect(drawn).toContain(`## ${RLM}סיכום`)
    expect(drawn).toContain(`- ${RLM}פריט ראשון`)
    expect(drawn).toContain(`  - ${RLM}פריט מקונן`)
    expect(drawn).toContain(`1. ${RLM}שלב אחד`)
    expect(drawn).toContain(`| ${RLM}פונט | ${RLM}Assistant |`)
    expect(drawn).toContain('|---|---|')
    expect(drawn).toContain('```bash\nclaude plugin validate .\n```')
    await reply.unmount()
    const prompt = await $.ui.mount({ ...PROMPT, surface })
    expect((await prompt.find({ type: 'Text' }))?.text).toBe(PROMPT.props.text)
    await prompt.unmount()
  }
})

test('an English reply is left to the engine', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  const ui = await $.ui.mount({
    ...message('All tests pass. See `register.tsx` for details.'),
    surface: 'desktop',
  })
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()
})

test('a Hebrew prompt reads right to left', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  const ui = await $.ui.mount({ ...PROMPT, surface: 'terminal' })
  const row = await ui.find({ type: 'Text', text: /תוסיף/ })
  expect(row?.props.dir).toBe('rtl')
  await ui.unmount()
})

test('the parser splits blocks and spans', () => {
  expect(isHebrew(REPLY)).toBe(true)
  expect(isHebrew('ok `שלום`')).toBe(false)
  expect(dirOf('Assistant')).toBe('ltr')
  expect(dirOf('2026')).toBe('rtl')
  expect(parse(REPLY).map(block => block.kind)).toEqual([
    'heading',
    'para',
    'list',
    'table',
    'code',
  ])
  expect(parse('שורה אחת\nשורה שתיים')).toEqual([
    { kind: 'para', text: 'שורה אחת\nשורה שתיים' },
  ])
  expect(parse('```ts\nconst a = 1').map(block => block.kind)).toEqual(['code'])
  expect(markRtl(markRtl('**CLI:** עודכן'))).toBe(`${RLM}**CLI:** עודכן`)
  expect(markRtl('~~~\n- not a list\n~~~')).toBe('~~~\n- not a list\n~~~')
  expect(markRtl('> ציטוט\n\n---')).toBe(`> ${RLM}ציטוט\n\n---`)
  const list = parse('- א\n  - ב\n- ג')[0]
  expect(list?.kind === 'list' ? list.items.map(item => item.depth) : []).toEqual([0, 1, 0])
  expect(spans('**מודגש** ו-`קוד`').map(span => span.kind)).toEqual([
    'bold',
    'text',
    'code',
  ])
})
