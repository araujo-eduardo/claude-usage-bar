export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Snapshot = {
  limits: Limit[]
  contextPercent?: number
  costUsd?: number
  updatedAt?: number
}

export type Tally = { tokens: number; calls: number }

export type Day = Tally & { models: Record<string, Tally> }

/** Keyed by local date, YYYY-MM-DD. */
export type History = Record<string, Day>

declare module 'claude-code' {
  interface PluginState {
    'usage-bar': {
      snapshot: Shaped<Snapshot>
      history: Shaped<History>
      warnedFor: Shaped<string>
    }
  }
}
