export type Lang = 'en' | 'pt-BR'

export type Strings = {
  weekdays: string[]
  decimal: string
  limitLabel: Record<string, string>
  statusLabel: Record<string, string>
  noLimits: string
  limits: string
  limitsPending: string
  resets: string
  session: string
  context: string
  cost: string
  last7Days: string
  tokensTurns: (tokens: string, turns: number) => string
  footnote: string
  paneTitle: string
  paneOpened: string
  commandDescription: string
  warn5h: (percent: string, reset: string) => string
}

const STRINGS: Record<Lang, Strings> = {
  en: {
    weekdays: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    decimal: '.',
    limitLabel: { five_hour: '5 hours', seven_day: 'Week', spend_limit: 'Spend' },
    statusLabel: { five_hour: '5h', seven_day: 'wk', spend_limit: 'spend' },
    noLimits: 'limits —',
    limits: 'Limits',
    limitsPending: 'No reading yet (shows after the first API response).',
    resets: 'resets',
    session: 'Session',
    context: 'Context',
    cost: 'Cost',
    last7Days: 'Last 7 days',
    tokensTurns: (tokens, turns) => `${tokens} tokens · ${turns} turns`,
    footnote: 'Tokens include cache. History only counts sessions with the mod active.',
    paneTitle: 'Claude usage',
    paneOpened: 'Usage pane opened.',
    commandDescription: 'Show Claude usage (limits, context, cost, last 7 days)',
    warn5h: (percent, reset) => `Claude: ${percent} of the 5h window used (resets ${reset})`,
  },
  'pt-BR': {
    weekdays: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
    decimal: ',',
    limitLabel: { five_hour: '5 horas', seven_day: 'Semana', spend_limit: 'Gasto' },
    statusLabel: { five_hour: '5h', seven_day: 'sem', spend_limit: 'gasto' },
    noLimits: 'limites —',
    limits: 'Limites',
    limitsPending: 'Sem leitura ainda (aparece após a primeira resposta da API).',
    resets: 'reinicia',
    session: 'Sessão',
    context: 'Contexto',
    cost: 'Custo',
    last7Days: 'Últimos 7 dias',
    tokensTurns: (tokens, turns) => `${tokens} tokens · ${turns} turnos`,
    footnote: 'Tokens incluem cache. Histórico só conta sessões com o mod ativo.',
    paneTitle: 'Uso do Claude',
    paneOpened: 'Painel de uso aberto.',
    commandDescription: 'Mostra uso do Claude (limites, contexto, custo, 7 dias)',
    warn5h: (percent, reset) => `Claude: ${percent} da janela de 5h usada (reinicia ${reset})`,
  },
}

export const strings = (lang: Lang): Strings => STRINGS[lang]

/** Maps a free-form hint ("pt-BR", "portuguese", "pt_BR.UTF-8") to a Lang. */
export const langFromHint = (hint: unknown): Lang | undefined => {
  if (typeof hint !== 'string' || hint.trim() === '') return undefined
  const h = hint.toLowerCase()
  if (h.startsWith('pt') || h.includes('portug')) return 'pt-BR'
  if (h.startsWith('en') || h.includes('english')) return 'en'
  return undefined
}

const systemLocale = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale
  } catch {
    return undefined
  }
}

/**
 * `auto` looks, in order, at Claude Code's `language` setting, the LANG /
 * LC_ALL environment variables and the runtime locale; English otherwise.
 */
export const resolveLang = async (
  option: unknown,
  readHints: () => Promise<unknown[]>,
): Promise<Lang> => {
  const explicit = option === 'auto' ? undefined : langFromHint(option)
  if (explicit) return explicit
  for (const hint of [...(await readHints()), systemLocale()]) {
    const lang = langFromHint(hint)
    if (lang) return lang
  }
  return 'en'
}
