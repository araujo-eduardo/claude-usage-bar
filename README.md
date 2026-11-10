# usage-bar

**English** · [Português (Brasil)](README.pt-BR.md)

A Claude Code mod that keeps your Claude usage in view: rate limits, context window and session cost in the status line, plus a side pane with a 7-day token history.

```
5h 82% (21:00) · wk 28% · ctx 41% · $1.23
```

## Features

- **Status line**, always visible: 5-hour window (with reset time), weekly window, context fill and session cost. Updates on its own whenever a figure moves, no polling.
- **Pane** (`/usage-bar`):
  - 5-hour and weekly limit bars with reset times, colored by usage: brand color below 70%, yellow from 70%, red from 90%;
  - context fill and session cost;
  - last 7 days: one bar per day, total tokens and turns, and a per-model breakdown.
- **Toast** once per 5-hour window when usage passes 90%.
- **English and Brazilian Portuguese.**

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install usage-bar --marketplace eduardo-araujo-isi/claude-usage-bar
```

From a shell:

```bash
claude plugin install usage-bar --marketplace eduardo-araujo-isi/claude-usage-bar
```

Answer `y` to add the marketplace, then pick a scope (user scope is the default).

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `eduardo-araujo-isi/claude-usage-bar`, then **Add plugin**.

## Configuration

| Option | Values | Default |
| --- | --- | --- |
| `language` | `auto`, `en`, `pt-BR` | `auto` |

`auto` follows Claude Code's `language` setting, then the `LC_ALL` / `LANG` environment variables, then the system locale, and falls back to English. Set it in `/config`, or in `~/.claude/settings.json`:

```json
"pluginConfigs": {
  "usage-bar@claude-usage-bar": { "options": { "language": "pt-BR" } }
}
```

## Notes and limits

- Limits come from the API's rate-limit headers, so they show `—` until the first response of the session. They only exist on a Claude subscription (Pro/Max); on API keys only context and cost are shown.
- Token counts include cache reads and writes, so they look large.
- The 7-day history starts empty on install and only counts sessions where the mod is active. It is kept for 30 days in the plugin's store.
- Two sessions running at the same time may each drop the odd turn from the history (last write wins).

## Development

```bash
claude plugin validate .
claude plugin test .
```

Code layout: `hooks/register.tsx` (hooks and pane), `hooks/i18n.ts` (strings), `types/index.d.ts` (state contract), `tests/`.

## License

[MIT](LICENSE)
