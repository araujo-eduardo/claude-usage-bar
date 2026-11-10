# usage-bar

[English](README.md) · **Português (Brasil)**

Um mod para o Claude Code que mantém seu uso do Claude à vista: limites, janela de contexto e custo da sessão na status line, mais um painel lateral com o histórico de tokens dos últimos 7 dias.

```
5h 82% (21:00) · sem 28% · ctx 41% · $1.23
```

## Recursos

- **Status line**, sempre visível: janela de 5 horas (com horário de reinício), janela semanal, ocupação do contexto e custo da sessão. Atualiza sozinha quando algum número muda, sem polling.
- **Painel** (`/usage-bar`):
  - barras dos limites de 5 horas e semanal com horário de reinício, coloridas pelo uso: cor do Claude abaixo de 70%, amarelo a partir de 70%, vermelho a partir de 90%;
  - ocupação do contexto e custo da sessão;
  - últimos 7 dias: uma barra por dia, total de tokens e turnos, e divisão por modelo.
- **Toast** uma vez por janela de 5 horas quando o uso passa de 90%.
- **Inglês e português do Brasil.**

## Instalação

No prompt de uma sessão do Claude Code no terminal:

```
/plugin install usage-bar --marketplace eduardo-araujo-isi/claude-usage-bar
```

Pelo shell:

```bash
claude plugin install usage-bar --marketplace eduardo-araujo-isi/claude-usage-bar
```

Responda `y` para adicionar o marketplace e escolha o escopo (o padrão é o escopo de usuário).

No app desktop, onde `/plugin` não funciona: clique em **+** ao lado da caixa do prompt, depois em **Plugins**, **Add marketplace** com `eduardo-araujo-isi/claude-usage-bar` e então **Add plugin**.

## Configuração

| Opção | Valores | Padrão |
| --- | --- | --- |
| `language` | `auto`, `en`, `pt-BR` | `auto` |

`auto` segue a configuração `language` do Claude Code, depois as variáveis de ambiente `LC_ALL` / `LANG`, depois o locale do sistema, e usa inglês se nada indicar o idioma. Configure em `/config` ou em `~/.claude/settings.json`:

```json
"pluginConfigs": {
  "usage-bar@claude-usage-bar": { "options": { "language": "pt-BR" } }
}
```

## Observações e limites

- Os limites vêm dos headers de rate limit da API, então aparecem como `—` até a primeira resposta da sessão. Só existem em assinatura do Claude (Pro/Max); com chave de API aparecem apenas contexto e custo.
- A contagem de tokens inclui leitura e escrita de cache, por isso os números parecem altos.
- O histórico de 7 dias começa vazio na instalação e só conta sessões com o mod ativo. Fica guardado por 30 dias no store do plugin.
- Duas sessões abertas ao mesmo tempo podem perder um turno ou outro do histórico (vale a última gravação).

## Desenvolvimento

```bash
claude plugin validate .
claude plugin test .
```

Estrutura: `hooks/register.tsx` (hooks e painel), `hooks/i18n.ts` (textos), `types/index.d.ts` (contrato de estado), `tests/`.

## Licença

[MIT](LICENSE)
