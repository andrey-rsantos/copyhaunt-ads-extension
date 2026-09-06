# Abrir o repositório: saneamento e publicação · Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Sem essa skill carregada, siga `AGENTS.md`, seção "O plano é o estado".

## Progresso

- **Estado:** não iniciado
- **Última tarefa concluída:** —
- **Próxima tarefa:** Task 1
- **Notas de retomada:** —

**Quando executar:** depois que o Bloco B fechar, e **antes** do primeiro push
para qualquer repositório público. Não antes: sanear cedo custa o material de
consulta enquanto ele ainda está sendo usado para decidir.

**Goal:** Tornar o repositório público sem publicar junto a análise do pacote
de terceiros, e sem perder o histórico — que é metade do valor de mostrar este
repositório.

## Por que isto existe

Dois documentos deste repositório descrevem, com identificadores e detalhes
internos, o pacote de uma extensão comercial de terceiros que serviu de
referência técnica. Nenhum código de lá foi reaproveitado, e o próprio spec
registra isso. Mas há diferença entre **declarar inspiração**, que é honesto e
bom para o produto, e **publicar um relatório de engenharia reversa**, que
convida atrito e faz o autor parecer auditor do concorrente em vez de autor do
próprio trabalho.

A decisão, tomada em 2026-09-06: a inspiração fica declarada; a análise do
pacote sai, e passa a viver fora do versionamento, como `refs/` já vive.

## Onde `$TERMO` aparece nos comandos

Os comandos abaixo buscam por `$TERMO`, e isso é literal: exporte a variável
com o nome comercial da referência antes de rodá-los, lendo-o do spec ainda
não saneado. O plano não o escreve — ver a regra logo abaixo.

```bash
export TERMO="<o nome, lido do spec antes da Task 1>"
```

## A regra que atravessa o plano

**Nenhuma tarefa aqui escreve os termos que estão sendo removidos.** Escrever
a lista dentro do repositório criaria uma nova ocorrência deles, e ela entraria
no histórico junto — exatamente o que o plano existe para evitar. A lista é
gerada na hora, a partir dos arquivos antes do saneamento, e vive num arquivo
temporário **fora** da árvore de trabalho.

## O que fica e o que sai

**Fica** — é o que sustenta as decisões, e some se apagarmos por atacado:

- que a Biblioteca de Anúncios entrega os anúncios por `XMLHttpRequest`, e que
  por isso o interceptador aplica patch em XHR;
- que coleta passiva, sem requisição própria, é a abordagem correta;
- que `sort_data[mode]=total_impressions` ordena por veiculação — parâmetro
  público da própria Meta;
- que config remota é a alternativa oficial do MV3 a código remoto;
- que existe uma extensão de referência no mercado, e que ela inspirou o
  estudo.

**Sai** — não sustenta decisão nenhuma, e só serve para identificar o alvo:

- identificador do pacote na loja, versão exata e estimativa de usuários;
- observações sobre o estado do bundle deles;
- nomes de constantes e variáveis internas do código deles;
- o detalhamento das regras de rede declarativas deles, uma a uma;
- o nome comercial do produto, onde ele aparecer.

---

## Task 1: Sanear o HEAD

**Files:**
- Modify: `docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md` (seção 3)
- Modify: `docs/superpowers/plans/2026-09-06-config-remota.md`

Esta tarefa roda no repositório de trabalho de sempre, é um commit comum, e
não depende de nenhuma das seguintes.

- [ ] **Step 1: Guardar o original fora do versionamento**

```bash
mkdir -p refs
git show HEAD:docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md > refs/spec-com-analise-completa.md
```

`refs/` está no `.gitignore` desde o primeiro commit. O material continua à
mão para consulta; só não vai a público.

- [ ] **Step 2: Levantar a lista de termos, fora da árvore**

```bash
grep -rn -i "$TERMO" docs/ > "$TMPDIR/termos-brutos.txt"
```

Ler esse arquivo e, dele, montar `$TMPDIR/termos.txt` no formato do
`git filter-repo --replace-text`, uma substituição por linha:

```
<termo literal>==><substituto neutro>
```

Um termo por identificador, por versão, por nome de constante e pelo nome
comercial. O substituto é sempre genérico: "a extensão de referência", "uma
constante de tempo de rolagem", e assim por diante.

**O arquivo fica em `$TMPDIR`, nunca no repositório.** A Task 2 o consome.

- [ ] **Step 3: Reescrever a seção 3 do spec**

Trocar o corpo da seção 3 por uma versão que responda "o que aprendemos e por
que decidimos assim", sem identificar o alvo. Manter a tabela de achados que
sustenta decisão, com as linhas reescritas em termos de comportamento
observável da Biblioteca, não de código de terceiro. Manter a frase que
registra que o estudo foi de arquitetura e que nenhum código foi reaproveitado.

Conferir também as demais menções no spec — seções 5, 11 e 12 — e a linha do
plano da config remota.

- [ ] **Step 4: Conferir que o HEAD está limpo**

```bash
grep -rn -i "$TERMO" . --include=*.md --exclude-dir=node_modules --exclude-dir=refs
npm.cmd test
```

Esperado: nenhuma ocorrência fora de `refs/`, e a suíte intacta — nada aqui
toca código.

Commit, no padrão de `AGENTS.md`, tipo `docs`, escopo `spec`.

---

## Task 2: Reescrever o histórico, num clone

**Nada nesta tarefa acontece no repositório de trabalho.** Se algo der errado,
o clone é descartado e nada se perde.

- [ ] **Step 1: Instalar a ferramenta**

```bash
python -m pip install git-filter-repo
git filter-repo --version
```

- [ ] **Step 2: Clonar fresco**

```bash
git clone --no-local . ../copyhaunt-publico
cd ../copyhaunt-publico
```

`--no-local` é obrigatório: sem ele o clone compartilha objetos com o original
por hard link, e reescrever o clone contamina o repositório de trabalho.

- [ ] **Step 3: Substituir em todo o histórico**

```bash
git filter-repo --replace-text "$TMPDIR/termos.txt"
```

Preserva os commits, as datas e as mensagens; troca apenas o conteúdo dos
trechos listados, em todos eles.

- [ ] **Step 4: Provar que não sobrou nada**

```bash
git rev-list --all | xargs -n 50 git grep -i -l "$TERMO" | head
git log --all -S "$TERMO" --oneline | cat
git log --oneline | wc -l
```

Esperado: as duas primeiras buscas sem resultado, e a contagem de commits
igual à do repositório de trabalho. **Se a contagem cair, pare**: o
`filter-repo` descartou commit, e isso não é o que este plano quer.

---

## Task 3: Repositório novo, público

`push --force` sobre o repositório privado existente **não** resolve: o GitHub
mantém os objetos antigos acessíveis por SHA depois do force-push, e eles
virariam públicos junto com o resto. Repositório novo não herda órfão nenhum.

- [ ] **Step 1: Varrer o que não pode ir a público**

```bash
git grep -i -E "api[_-]?key|secret|token|password|Bearer " -- . | head
cat config/config.json
```

Nada de credencial. Os valores de `config/config.json` são operacionais e
públicos por natureza — conferir mesmo assim, uma vez, com os olhos.

- [ ] **Step 2: Criar e empurrar**

```bash
gh repo create <nome> --public --description "<uma linha>" --source=. --push
```

O repositório privado atual **fica como está**, com o material completo. Ele
passa a ser o repositório de trabalho; o novo é o espelho público.

- [ ] **Step 3: Conferir pelo lado de fora**

Abrir o repositório publicado e procurar pelos termos na busca do próprio
GitHub, que indexa o histórico. Esperado: nada.

---

## Task 4: O que o visitante vê

- [ ] **Step 1: `LICENSE`**

MIT. Repositório público sem licença é "todos os direitos reservados" por
padrão: ninguém pode usar legalmente, que é o oposto da intenção.

- [ ] **Step 2: `README.md`**

Seções, nesta ordem: o que é, como instalar sem a loja, como funciona em três
parágrafos, e **"Inspiração e diferenças"**.

A última seção é a que importa para quem chega de fora, e ela se escreve com
número, não com adjetivo. Os números já estão medidos e registrados no spec e
nos planos:

| Eixo | CopyHaunt |
|---|---|
| Permissões | uma: `storage` |
| Regras de rede declarativas | nenhuma — o Spike 1 mediu que o CDN de mídia responde `Access-Control-Allow-Origin: *` |
| Backend | nenhum; a config remota é um JSON estático no próprio repositório |
| Caminho do dado | content script como hub, sem passar pelo painel no caminho quente |
| Permissão `downloads` | dispensada: blob mais âncora |

Comparar com "a referência de mercado" sem nomeá-la. Quem é do ramo sabe qual
é; quem não é, não precisa saber.

- [ ] **Step 3: Conferir que o README não reintroduz o que a Task 1 tirou**

```bash
grep -rn -i "$TERMO" README.md
```

Esperado: nada.

---

## Verificação final

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
git log --all -S "$TERMO" --oneline | cat
```

## O que este plano NÃO faz

- **Não republica no repositório privado existente.** Ele continua sendo o
  repositório de trabalho, com o histórico como está.
- **Não apaga `refs/`.** O material de consulta continua no disco, fora do
  versionamento.
- **Não trata de marca.** *CopyHaunt* e o nome da referência são próximos, no
  mesmo mercado. Não é impedimento técnico e ninguém aqui é advogado — fica
  registrado como coisa a decidir antes de divulgar amplo.
- **Não publica na Chrome Web Store.** Isso é o bloco E do spec, e tem
  requisitos próprios: ficha, capturas, política de privacidade.
