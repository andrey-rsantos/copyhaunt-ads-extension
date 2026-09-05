# CopyHaunt Ads

Extensão de navegador (Chrome MV3) de *ad intelligence* para a Biblioteca de
Anúncios da Meta. Público: gestores de tráfego e infoprodutores que precisam
espionar e modelar ofertas concorrentes.

- Identidade visual: `CopyHaunt-IDV.md` (cores, tipografia, mascote, componentes)
- Referências visuais: `refs/` (fora do versionamento)
- Design técnico: `docs/superpowers/specs/`

## Idioma

Toda comunicação, documentação e mensagem de commit em **pt-BR**, com acentuação
correta. Identificadores de código, nomes de arquivo e tipos de commit
permanecem em inglês.

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

## Divisão de trabalho entre agentes

Claude planeja e revisa. Codex executa.

| Papel | Quem | Skills |
|---|---|---|
| Design e plano | Claude | `brainstorming`, `writing-plans` |
| Implementação | Codex | — |
| Revisão | Claude | `requesting-code-review` |

### Invocação do Codex

Sempre com estas flags. **Nunca alterar o `~/.codex/config.toml` global** — ele
vale para todos os outros projetos da máquina.

```
codex exec -m gpt-5.6-luna -c model_reasoning_effort="high"
```

Na primeira execução, o Codex vai pedir confirmação de acesso: este diretório
ainda não consta como `trusted` na configuração dele.

### Consequência para os planos

O Codex **não carrega as skills do Superpowers e não lê este arquivo**. Ele
começa cada tarefa sem contexto da conversa que originou o plano.

Portanto, cada tarefa do plano precisa carregar a disciplina por escrito:

- o teste que falha primeiro, e o comando exato para rodá-lo
- o caminho exato de cada arquivo a criar ou alterar
- o critério de verificação, com a saída esperada
- a mensagem de commit já no padrão desta página

Tarefa que diz apenas "implementar o normalizador" é tarefa mal escrita para
este arranjo.
