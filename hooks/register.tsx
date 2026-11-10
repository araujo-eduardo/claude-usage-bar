import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit, TurnUsage } from 'claude-code'

import type { Day, History, Limit, Snapshot } from '../types'
import { resolveLang, strings } from './i18n'
import type { Strings } from './i18n'

const PANE = 'usage-bar'
const COMMAND = 'usage-bar'
const STORE_KEY = 'history-v1'
const KEEP_DAYS = 30
const WARN_AT = 90
const CAUTION_AT = 70
const DAY_MS = 86_400_000

// Bump a shape tag when that value's fields change: values an earlier
// version stored survive reloads and are declined on a tag mismatch.
const snapshot = atom({ plugin: 'usage-bar', key: 'snapshot' } as const, { limits: [] } as Snapshot, {
  shape: 'snapshot-1',
})
const history = atom({ plugin: 'usage-bar', key: 'history' } as const, {} as History, {
  shape: 'history-1',
})
const warnedFor = atom({ plugin: 'usage-bar', key: 'warnedFor' } as const, '', {
  shape: 'warned-1',
})

// ---------- pure helpers ----------

const pad = (n: number) => String(n).padStart(2, '0')

export const dayKey = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const lastDays = (t: Strings, nowMs: number, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const ms = nowMs - (count - 1 - i) * DAY_MS
    return { key: dayKey(ms), label: t.weekdays[new Date(ms).getDay()] ?? '', isToday: i === count - 1 }
  })

export const compact = (t: Strings, n: number) => {
  const units: [number, string][] = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'k'],
  ]
  for (const [size, suffix] of units) {
    if (n >= size) return `${(n / size).toFixed(n >= size * 100 ? 0 : 2).replace('.', t.decimal)}${suffix}`
  }
  return String(n)
}

export const resetLabel = (t: Strings, iso: string | undefined, nowMs: number) => {
  if (!iso) return ''
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  const hhmm = `${pad(at.getHours())}:${pad(at.getMinutes())}`
  if (dayKey(at.getTime()) === dayKey(nowMs)) return hhmm
  if (at.getTime() - nowMs < 7 * DAY_MS) return `${t.weekdays[at.getDay()] ?? ''} ${hhmm}`
  return `${pad(at.getDate())}/${pad(at.getMonth() + 1)} ${hhmm}`
}

export const bar = (percent: number, width: number) => {
  const w = Math.max(4, width)
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * w)
  return '█'.repeat(filled) + '░'.repeat(w - filled)
}

const pct = (n: number) => `${Math.round(n)}%`

/** Below 70%: brand color; 70–89%: warning; 90%+: error. */
export const limitColor = (percent: number) =>
  percent >= WARN_AT ? 'error' : percent >= CAUTION_AT ? 'warning' : 'claude'

export const statusText = (t: Strings, s: Snapshot, nowMs: number) => {
  const parts = s.limits.map(l => {
    const reset = l.kind === 'five_hour' ? resetLabel(t, l.resetsAt, nowMs) : ''
    return `${t.statusLabel[l.kind] ?? l.kind} ${pct(l.percentUsed)}${reset ? ` (${reset})` : ''}`
  })
  if (parts.length === 0) parts.push(t.noLimits)
  if (s.contextPercent !== undefined) parts.push(`ctx ${pct(s.contextPercent)}`)
  if (s.costUsd !== undefined) parts.push(`$${s.costUsd.toFixed(2)}`)
  return parts.join(' · ')
}

const tokensOf = (u: TurnUsage) =>
  u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens

export const addTurn = (base: History, key: string, model: string, tokens: number): History => {
  const day: Day = base[key] ?? { tokens: 0, calls: 0, models: {} }
  const m = day.models[model] ?? { tokens: 0, calls: 0 }
  return {
    ...base,
    [key]: {
      tokens: day.tokens + tokens,
      calls: day.calls + 1,
      models: { ...day.models, [model]: { tokens: m.tokens + tokens, calls: m.calls + 1 } },
    },
  }
}

export const prune = (all: History, nowMs: number): History => {
  const cutoff = dayKey(nowMs - KEEP_DAYS * DAY_MS)
  return Object.fromEntries(Object.entries(all).filter(([k]) => k >= cutoff))
}

const toLimits = (r: SessionRateLimit[]): Limit[] =>
  r.map(({ kind, percentUsed, resetsAt }) => (resetsAt ? { kind, percentUsed, resetsAt } : { kind, percentUsed }))

const isHistory = (v: unknown): v is History => typeof v === 'object' && v !== null && !Array.isArray(v)

// ---------- language ----------

// Resolved once per load; a change of the option reloads the module and
// starts this file over.
let cachedStrings: Promise<Strings> | undefined

const quiet = <T,>(p: Promise<T>) => p.catch(() => undefined)

async function loadStrings($: EngineInterface, option: unknown): Promise<Strings> {
  cachedStrings ??= resolveLang(option, async () => [
    await quiet($.settings.read({ key: 'language' })),
    await quiet($.env.get('LC_ALL')),
    await quiet($.env.get('LANG')),
  ]).then(strings)
  return cachedStrings
}

// ---------- hooks ----------

export const register: Register = (on, options) => {


  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    const t = await loadStrings($, options.language)

    await $.command.register({ name: COMMAND, description: t.commandDescription })

    const stored = await $.store.get(STORE_KEY)
    if (isHistory(stored)) await update($, history, () => stored)

    const usage = await $.session.usage()
    const now = await $.clock.now()
    const s: Snapshot = {
      limits: toLimits(usage.rateLimits),
      contextPercent: usage.context.percent,
      costUsd: usage.cost?.usd,
      updatedAt: now,
    }
    await update($, snapshot, () => s)
    $.ui.status(statusText(t, s, now))

    return ran
  })

  on('command.run', { command: COMMAND }, async $ => {
    const t = await loadStrings($, options.language)
    await $.ui.open({ id: PANE, title: t.paneTitle })
    return { text: t.paneOpened }
  })

  on('session.measure', async ($, e, next) => {
    const ran = await next(e)
    const t = await loadStrings($, options.language)
    const now = await $.clock.now()
    const s: Snapshot = {
      limits: toLimits(e.rateLimits),
      contextPercent: e.context.percent,
      costUsd: e.cost?.usd,
      updatedAt: now,
    }
    await update($, snapshot, () => s)
    $.ui.status(statusText(t, s, now))

    // One toast per 5h window crossing the threshold.
    const fiveHour = s.limits.find(l => l.kind === 'five_hour')
    if (fiveHour && fiveHour.percentUsed >= WARN_AT) {
      const windowId = fiveHour.resetsAt ?? 'unknown'
      if ((await read($, warnedFor)) !== windowId) {
        await update($, warnedFor, () => windowId)
        $.ui.toast(t.warn5h(pct(fiveHour.percentUsed), resetLabel(t, fiveHour.resetsAt, now)))
      }
    }

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    const usage = ran.usage ?? e.usage
    if (!usage) return ran

    const now = await $.clock.now()
    // Re-read the store first: other sessions write the same key.
    const stored = await $.store.get(STORE_KEY)
    const base = isHistory(stored) ? stored : await read($, history)
    const nextHistory = prune(addTurn(base, dayKey(now), usage.model, tokensOf(usage)), now)

    await $.store.set(STORE_KEY, nextHistory)
    await update($, history, () => nextHistory)

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const t = await loadStrings($, options.language)
    const s = await read($, snapshot)
    const hist = await read($, history)
    const now = await $.clock.now()

    const columns = e.props.bodyColumns ?? 40
    const barWidth = Math.max(8, Math.min(30, columns - 22))

    const week = lastDays(t, now, 7).map(d => ({ ...d, day: hist[d.key] }))
    const weekTokens = week.reduce((sum, d) => sum + (d.day?.tokens ?? 0), 0)
    const weekCalls = week.reduce((sum, d) => sum + (d.day?.calls ?? 0), 0)
    const peak = Math.max(1, ...week.map(d => d.day?.tokens ?? 0))

    const models: Record<string, { tokens: number; calls: number }> = {}
    for (const d of week) {
      for (const [name, tally] of Object.entries(d.day?.models ?? {})) {
        const m = models[name] ?? { tokens: 0, calls: 0 }
        models[name] = { tokens: m.tokens + tally.tokens, calls: m.calls + tally.calls }
      }
    }
    const modelRows = Object.entries(models).sort((a, b) => b[1].tokens - a[1].tokens)

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>{t.limits}</Text>
          {s.limits.length === 0 && <Text dimColor>{t.limitsPending}</Text>}
          {s.limits.map(l => (
            <Box flexDirection="column" marginTop={1}>
              <Box flexDirection="row" justifyContent="space-between">
                <Text>{t.limitLabel[l.kind] ?? l.kind}</Text>
                <Text bold tabular color={limitColor(l.percentUsed)}>
                  {pct(l.percentUsed)}
                </Text>
              </Box>
              <Text color={limitColor(l.percentUsed)}>{bar(l.percentUsed, barWidth)}</Text>
              {l.resetsAt && (
                <Text dimColor>
                  {t.resets} {resetLabel(t, l.resetsAt, now)}
                </Text>
              )}
            </Box>
          ))}
        </Box>

        <Box flexDirection="column">
          <Text bold>{t.session}</Text>
          <Box flexDirection="column" marginTop={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text>{t.context}</Text>
              <Text tabular>{s.contextPercent === undefined ? '—' : pct(s.contextPercent)}</Text>
            </Box>
            {s.contextPercent !== undefined && <Text color="suggestion">{bar(s.contextPercent, barWidth)}</Text>}
            <Box flexDirection="row" justifyContent="space-between">
              <Text>{t.cost}</Text>
              <Text tabular>{s.costUsd === undefined ? '—' : `$${s.costUsd.toFixed(2)}`}</Text>
            </Box>
          </Box>
        </Box>

        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Text bold>{t.last7Days}</Text>
            <Text tabular>{t.tokensTurns(compact(t, weekTokens), weekCalls)}</Text>
          </Box>
          <Box flexDirection="column" marginTop={1}>
            {week.map(d => (
              <Box flexDirection="row" gap={1}>
                <Text bold={d.isToday} dimColor={!d.isToday} mono>
                  {d.label.padEnd(4)}
                </Text>
                <Text color="claude" mono>
                  {bar(((d.day?.tokens ?? 0) / peak) * 100, barWidth)}
                </Text>
                <Text tabular dimColor={!d.day}>
                  {compact(t, d.day?.tokens ?? 0)}
                </Text>
              </Box>
            ))}
          </Box>
          {modelRows.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              {modelRows.map(([name, tally]) => (
                <Box flexDirection="row" justifyContent="space-between">
                  <Text dimColor>{name}</Text>
                  <Text tabular>
                    {compact(t, tally.tokens)} · {tally.calls}
                  </Text>
                </Box>
              ))}
            </Box>
          )}
          <Box marginTop={1}>
            <Text dimColor>{t.footnote}</Text>
          </Box>
        </Box>
      </Box>
    )
  })
}
