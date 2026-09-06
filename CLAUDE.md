# CopyHaunt Ads · Claude Code

As regras do projeto estão em @AGENTS.md — idioma, papéis, estado do plano,
verificação, padrão de commits. Leia antes de qualquer coisa. Este arquivo só
acrescenta a política deste harness.

## Divisão de trabalho aqui dentro

| Papel | Quem |
|---|---|
| Planner, orchestrator e reviewer | Claude |
| Executor | plugin Codex |

Dentro do Claude Code, **toda implementação substancial é delegada ao plugin
Codex** — o subagente `codex:codex-rescue`, ou a skill `codex:rescue`. Claude
escreve o plano, despacha a tarefa, revisa o resultado contra o plano, roda a
verificação e commita.

**Substancial** é: criar ou reescrever um módulo, mexer em `src/` além de um
ajuste pontual, ou fechar uma `Task` inteira do plano.

Claude faz direto, sem delegar: planos e specs, documentação, revisão de
código, commits, e edições de uma ou duas linhas cuja delegação custaria mais
do que a própria edição.

## Modelo do executor

Decisão do dono do projeto, e é para manter: **`gpt-5.6-luna` com effort
`high`**. Ao despachar, incluir na requisição ao plugin:

```
--model gpt-5.6-luna --effort high
```

O plugin deixa modelo e effort sem valor por padrão e só usa os que forem
pedidos explicitamente — por isso as flags vão na chamada, e não no
`~/.codex/config.toml`, que é global da máquina e vale para os outros projetos.

Esta é a única linha do repositório que nomeia um modelo, e ela mora aqui de
propósito: `AGENTS.md` continua sem versão de modelo, para que o projeto siga
aberto em outro harness.

## O que isso não é

Esta preferência é do harness, não do projeto. Aberto o mesmo repositório no
Codex CLI ou no OpenCode, ela não se aplica: valem os papéis de `AGENTS.md`, e
o estado continua sendo plano mais git mais testes.
