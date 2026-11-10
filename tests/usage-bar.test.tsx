import { expect, test } from 'claude-code/testing'

const NOW = Date.UTC(2026, 10, 9, 15, 0)
const RESET = new Date(NOW + 2 * 3_600_000).toISOString()

const PANE = {
  plugin: 'usage-bar',
  component: 'Pane',
  requestId: 'usage-bar',
  props: {
    title: 'Uso do Claude',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const USAGE = {
  startedAt: NOW,
  context: { window: 200_000, tokens: 82_000, percent: 41 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 82, resetsAt: RESET },
    { kind: 'seven_day', percentUsed: 28 },
  ],
  cost: { usd: 1.234 },
}

const engine = (on: any, store: Record<string, unknown>, sink: { status: (string | undefined)[]; toasts: string[] }) => {
  on('command.register', () => ({ value: { command: 'usage-bar' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: USAGE }))
  on('clock.now', () => ({ value: NOW }))
  on('store.get', (_: unknown, e: { key: string }) => ({ value: store[e.key] }))
  on('store.set', (_: unknown, e: { key: string; value: unknown }) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('ui.status', (_: unknown, e: { text: string | undefined }) => {
    sink.status.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', (_: unknown, e: { text: string }) => {
    sink.toasts.push(e.text)
    return { value: undefined }
  })
  on('session.measure', (_: unknown, e: { changed: string[] }) => ({ changed: e.changed }))
  on('turn.complete', (_: unknown, e: { answer: string; usage?: unknown }) => ({ text: e.answer, usage: e.usage }))
}

test('status line shows limits, context and cost; toast once past 90%', { options: { language: 'pt-BR' } }, async ($, on) => {
  const store: Record<string, unknown> = {}
  const sink = { status: [] as (string | undefined)[], toasts: [] as string[] }
  engine(on, store, sink)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(sink.status.at(-1)).toMatch(/^5h 82% \(\d\d:\d\d\) · sem 28% · ctx 41% · \$1\.23$/)

  const measure = {
    context: USAGE.context,
    rateLimits: [{ kind: 'five_hour', percentUsed: 93, resetsAt: RESET }],
    cost: { usd: 2 },
    changed: ['rateLimits' as const],
  }
  await $.session.measure(measure)
  await $.session.measure(measure)
  expect(sink.status.at(-1)).toMatch(/^5h 93%/)
  expect(sink.toasts.length).toBe(1)
})

test('turns accumulate into the stored history and the pane draws it', { options: { language: 'pt-BR' } }, async ($, on) => {
  const store: Record<string, unknown> = {}
  const sink = { status: [] as (string | undefined)[], toasts: [] as string[] }
  engine(on, store, sink)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const usage = {
    model: 'claude-opus-5-5',
    input_tokens: 1_000,
    output_tokens: 500,
    cache_read_input_tokens: 1_500_000,
    cache_creation_input_tokens: 0,
  }
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', usage })
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't2', reason: 'answer', usage })

  const history = store['history-v1'] as Record<string, { tokens: number; calls: number }>
  const today = Object.values(history)[0]
  expect(today?.tokens).toBe(3_003_000)
  expect(today?.calls).toBe(2)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /turnos/ }))?.text).toBe('3,00M tokens · 2 turnos')
    expect((await ui.find({ type: 'Text', text: /^claude-opus-5-5$/ }))?.text).toBe('claude-opus-5-5')
    expect((await ui.find({ type: 'Text', text: /^82%$/ }))?.text).toBe('82%')
    await ui.unmount()
  }
})

test('English labels when language is en', { options: { language: 'en' } }, async ($, on) => {
  const sink = { status: [] as (string | undefined)[], toasts: [] as string[] }
  engine(on, {}, sink)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(sink.status.at(-1)).toMatch(/· wk 28% ·/)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^Last 7 days$/ }))?.text).toBe('Last 7 days')
  expect((await ui.find({ type: 'Text', text: /turns$/ }))?.text).toBe('0 tokens · 0 turns')
  await ui.unmount()
})

test('auto follows the language setting', { options: { language: 'auto' } }, async ($, on) => {
  const sink = { status: [] as (string | undefined)[], toasts: [] as string[] }
  engine(on, {}, sink)
  on('settings.read', () => ({ value: { language: 'portuguese' } }))
  on('env.get', () => ({ value: undefined }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(sink.status.at(-1)).toMatch(/· sem 28% ·/)
})
