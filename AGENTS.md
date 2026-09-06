# CopyHaunt Ads

Extensão de navegador (Chrome MV3) de *ad intelligence* para a Biblioteca de
Anúncios da Meta. Público: gestores de tráfego e infoprodutores que precisam
espionar e modelar ofertas concorrentes.

- Identidade visual: `CopyHaunt-IDV.md` (cores, tipografia, mascote, componentes)
- Referências visuais: `refs/` (fora do versionamento)
- Design técnico: `docs/superpowers/specs/`
- Planos de execução: `docs/superpowers/plans/`

**Este arquivo é a fonte canônica das regras do projeto.** Vale para qualquer
agente em qualquer harness — Claude Code, Codex CLI, OpenCode. `CLAUDE.md`
importa este arquivo e acrescenta somente a política do harness Claude Code;
nada que valha para o projeto inteiro deve morar lá.

## Idioma

Toda comunicação, documentação e mensagem de commit em **pt-BR**, com acentuação
correta. Identificadores de código, nomes de arquivo e tipos de commit
permanecem em inglês.

## Papéis

Papel, não fornecedor. Um mesmo agente pode acumular os três; o que não pode é
um papel sumir.

| Papel | Responsabilidade |
|---|---|
| Planner | Transforma spec em plano com tarefas verificáveis, em `docs/superpowers/plans/` |
| Executor | Implementa tarefa a tarefa, teste antes da implementação, e registra progresso |
| Reviewer | Confere o resultado contra o plano, roda a verificação e commita |

Quem assume cada papel é decisão do ambiente, não do repositório. O harness
Claude Code declara a sua preferência em `CLAUDE.md`. Fora dele, um único
agente pode fazer os três — desde que o estado continue no repositório.

## O plano é o estado

Regra central deste projeto. Checkbox que ninguém marca é documentação, não
estado: o trabalho vira irretomável no instante em que a sessão morre.

Ao concluir cada unidade lógica de trabalho — em geral um `Step`, sempre ao
fechar uma `Task`:

1. **Rodar a verificação** daquela tarefa. O comando está escrito nela.
2. **Marcar `- [x]`** no passo concluído, no próprio plano.
3. **Atualizar o bloco Progresso** do plano.
4. **Fazer checkpoint**: commit quando a tarefa fecha um comportamento
   verificável. Tarefa que só prepara terreno pode esperar a seguinte.

Marcar `[x]` antes de a verificação passar é pior do que não marcar: produz
estado falso, e estado falso custa mais caro que estado ausente.

### Bloco de Progresso

Todo plano carrega, logo abaixo do título:

```markdown
## Progresso

- **Estado:** não iniciado | em andamento | concluído
- **Última tarefa concluída:** —
- **Próxima tarefa:** Task 1
- **Notas de retomada:** —
```

Quem executa mantém esse bloco. É a primeira coisa que qualquer agente lê ao
abrir o repositório, e a última coisa que qualquer agente escreve ao parar.
"Notas de retomada" é para o que o plano não previu: decisão tomada no meio do
caminho, arquivo deixado sujo de propósito, descoberta que muda a tarefa
seguinte.

## Como retomar o trabalho

Vale para qualquer harness, inclusive um que nunca viu este repositório. Nada
aqui depende do transcript de uma sessão.

1. Ler este arquivo.
2. Achar o plano ativo:
   `git status` e `git log --oneline -5 -- docs/superpowers/plans/`.
   O plano ainda não commitado, ou o mais recente, costuma ser o ativo.
3. Ler o bloco **Progresso** e localizar o primeiro `- [ ]` do plano: é a
   próxima tarefa.
4. Conferir se o disco bate com o que o plano afirma: `npm test` e
   `npm run typecheck`.
5. Ver o que a sessão anterior deixou solto: `git status`, `git diff`,
   `git log --oneline -10`.

Se o plano disser "concluído" e a verificação falhar, **a verificação ganha**:
o plano está mentindo e o primeiro trabalho é consertar isso.

## Verificação

| Comando | Para quê |
|---|---|
| `npm test` | Vitest, suíte inteira |
| `npm run typecheck` | TypeScript sem emitir |
| `npm run verify:build` | Build mais checagem do manifest gerado |
| `npm run e2e` | Playwright |

- **No PowerShell do Windows, usar `npm.cmd` e `npx.cmd`.**
- **Nunca rodar `npm run gravar:fixtures`.** Ele regrava as fixtures contra a
  Meta ao vivo; rodar sem querer destrói a base de comparação dos testes.
- Nenhuma tarefa está pronta sem o comando rodado e a saída conferida. Alegação
  de sucesso sem saída não conta.

## Convenções que valem em todo plano

- **Teste antes da implementação.** O plano nomeia o teste que falha primeiro.
- **Nada de espera por tempo fixo em teste.** Use `vi.waitFor`, `expect.poll`
  ou o auto-waiting do Playwright. Espera chutada passa isolada e quebra na
  suíte.
- **Permissões e manifest são travados pelo `verify:build`.** Se uma tarefa
  parecer precisar de permissão nova, pare: em geral o desenho está errado.
- **Quem commita é o reviewer.** Quando executor e reviewer são agentes
  distintos, o executor escreve a mensagem em `.commit-msg-codex` e para.
  Quando são o mesmo agente, ele commita direto, no padrão abaixo.

## Padrão de commits

Baseado em Conventional Commits. O tipo é etiqueta para ferramentas, por isso
fica em inglês; todo o texto legível é em pt-BR.

### Formato

```
<emoji> <tipo>(<escopo>): <descrição, minúscula, sem ponto final, até 72 caracteres>

O que foi feito:
- ...

Como foi feito:
- ...

Considerações:
- ...
```

Descrição no **infinitivo**: `adicionar filtro de data`, não `adiciona` nem
`adicionado`.

### Tipos

| Tipo | Emoji | Uso |
|---|---|---|
| `feat` | ✨ | nova funcionalidade |
| `fix` | 🐛 | correção de bug |
| `docs` | 📚 | documentação |
| `style` | 🔧 | formatação, sem mudança de lógica |
| `refactor` | ♻️ | reestruturação sem mudar comportamento |
| `perf` | ⚡ | ganho de performance |
| `test` | 🧪 | testes |
| `build` | 📦 | build e dependências |
| `chore` | 🔨 | tarefas administrativas |

### Escopos

`interceptor`, `normalizer`, `overlay`, `miner`, `config`, `ui`, `spec`,
`build`. Novos escopos podem ser criados quando surgir um módulo novo — basta
que o nome corresponda a uma fronteira real do código.

### Quando preencher cada seção

O corpo é **condicional**, não obrigatório. Corpo preenchido por obrigação vira
ruído e ensina quem lê o histórico a ignorá-lo.

| Seção | Quando incluir |
|---|---|
| Título | sempre |
| O que foi feito | quando o título sozinho não cobre o escopo da mudança |
| Como foi feito | quando a abordagem **não é óbvia** olhando o diff |
| Considerações | quando há algo que **o diff não conta**: trade-off aceito, limitação conhecida, pendência deixada de propósito |

Commit pequeno fica em uma linha. Assim, ver um corpo grande já sinaliza
"preste atenção aqui".

### Exemplo

```
✨ feat(miner): adicionar filtro por presença do anunciante na busca

O que foi feito:
- Contabilizar quantos anúncios de cada pageId apareceram na sessão
- Expor o mínimo como critério configurável no painel

Como foi feito:
- Contagem em memória durante a normalização, sem requisição adicional
- Índice Map<pageId, número> descartado ao encerrar a sessão

Considerações:
- Mede presença no nicho pesquisado, não o total global do anunciante.
  O total exigiria requisição ativa por anunciante e quebraria o
  desenho passivo da coleta
```

## Metodologia

Superpowers, upstream, sem fork nem customização local. Onde o harness carrega
as skills, use-as: `brainstorming` e `writing-plans` para planejar,
`test-driven-development` para executar, `requesting-code-review` para revisar.

Onde o harness não carrega, **o plano carrega a disciplina por escrito** — é
por isso que cada tarefa traz o teste que falha primeiro, o caminho exato de
cada arquivo, o critério de verificação com a saída esperada e a mensagem de
commit já no padrão. Nenhum agente deve precisar de skill carregada para saber
o que fazer aqui. Tarefa que diz apenas "implementar o normalizador" é tarefa
mal escrita para este arranjo.

## Ambiente do agente

Modelo, provider, flags de reasoning e roteamento são responsabilidade do
ambiente, **não do repositório**. Nada neste arquivo fixa versão de modelo, e
nada aqui deve passar a fixar.

Não altere configuração global da máquina — `~/.codex/config.toml`, por
exemplo — por causa deste projeto: ela vale para todos os outros também.
