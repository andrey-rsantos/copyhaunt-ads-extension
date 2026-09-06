# Abrir o repositório: posicionamento e publicação · Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Sem essa skill carregada, siga `AGENTS.md`, seção "O plano é o estado".

## Progresso

- **Estado:** não iniciado
- **Última tarefa concluída:** —
- **Próxima tarefa:** Task 1
- **Notas de retomada:** —

**Quando executar:** depois que o Bloco B fechar, e **antes** do primeiro push
para qualquer repositório público.

**Goal:** Abrir o repositório com o posicionamento certo — alternativa
gratuita e de código aberto, inspirada no referência de mercado — sem publicar junto a
análise do pacote deles.

## O posicionamento, decidido em 2026-09-06

O CopyHaunt **não** se apresenta como trabalho de origem independente. Ele se
apresenta como **alternativa gratuita e de código aberto, inspirada no referência de mercado
Ads**. O nome da referência fica, no README e no spec: é o pitch, não ruído.

Uma escolha de redação, e ela importa: *"alternativa gratuita e de código
aberto, inspirada no referência de mercado"*, e **não** *"minha versão do referência de mercado"*. A
segunda sugere afiliação e continuidade do produto deles; a primeira compara,
que é uso normal de marca alheia. Ninguém aqui é advogado — a diferença é
barata de escrever e cara de consertar depois.

Manter, em lugar visível, a frase que o spec já traz: o estudo foi de
arquitetura e **nenhum código de terceiros foi reaproveitado**. Com este
posicionamento, "isso é um fork deles?" vira a primeira pergunta de quem
chega, e essa frase responde antes de ser feita.

## O que fica e o que sai

Com o nome mantido, o corte deixa de ser sobre a marca e passa a ser sobre uma
coisa só: **a análise do pacote**.

**Fica** — sustenta decisão, e é observável de fora por qualquer um:

- a Biblioteca entrega os anúncios por `XMLHttpRequest`, e por isso o
  interceptador aplica patch em XHR;
- coleta passiva, sem requisição própria, é a abordagem correta;
- `sort_data[mode]=total_impressions` ordena por veiculação — parâmetro
  público da Meta;
- config remota é a alternativa oficial do MV3 a código remoto;
- o nome da referência, e o fato de ela ter inspirado o estudo.

**Sai** — não sustenta decisão nenhuma, e descreve o processo de engenharia
reversa de um produto comercial, que os Termos da Chrome Web Store e o EULA
deles não autorizam:

- identificador do pacote na loja, versão exata e estimativa de usuários;
- observações sobre o estado do bundle deles;
- nomes de constantes e variáveis internas do código deles;
- o detalhamento das regras de rede declarativas deles, uma a uma.

O teste para cada linha: **alguma decisão nossa cai se isto sumir?** Se não
cai, sai.

---

## Task 1: Reescrever a seção 3 do spec

**Files:**
- Modify: `docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md` (seção 3)
- Modify: `docs/superpowers/plans/2026-09-06-config-remota.md` (a linha que
  descreve o endpoint de config deles)

- [ ] **Step 1: Guardar o original fora do versionamento**

```bash
mkdir -p refs
git show HEAD:docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md > refs/spec-com-analise-completa.md
```

`refs/` está no `.gitignore` desde o primeiro commit. O material continua à
mão; só não vai a público.

- [ ] **Step 2: Reescrever**

A seção 3 passa a responder "o que aprendemos sobre a Biblioteca, e por que
decidimos assim", em vez de "o que encontramos dentro do pacote deles".

Manter o título da seção citando a referência e a frase sobre não reaproveitar
código. Manter a tabela de achados, com cada linha reescrita como
comportamento da **Biblioteca**, não como trecho do código **deles** — a
evidência vira o que se observa na rede e na página, não o nome da constante.

Na subseção das regras de rede, guardar apenas a conclusão que interessa a
nós: nenhuma delas trata do CDN de mídia, e foi disso que nasceu o Spike 1.

No plano da config remota, a menção passa a ser: eles também mantêm config
remota. Sem o caminho do endpoint.

- [ ] **Step 3: Conferir**

```bash
npm.cmd test
```

Esperado: suíte intacta — nada aqui toca código. Commit no padrão de
`AGENTS.md`, tipo `docs`, escopo `spec`.

---

## Task 2: O que o visitante vê

**Files:**
- Create: `LICENSE`
- Create: `README.md`

- [ ] **Step 1: `LICENSE`**

MIT. Repositório público sem licença é "todos os direitos reservados" por
padrão: ninguém pode usar legalmente, que é o oposto da intenção.

- [ ] **Step 2: `README.md`**

Nesta ordem: o que é e para quem, como instalar sem a loja, como funciona em
três parágrafos, **posicionamento**, e como contribuir.

O posicionamento, em uma frase logo no topo:

> Alternativa gratuita e de código aberto ao referência de mercado, para espionar
> criativos na Biblioteca de Anúncios da Meta. Inspirado nele; escrito do
> zero, com desenho próprio.

E a tabela que transforma "melhor" em número — todos já medidos e registrados
no spec e nos planos deste repositório:

| Eixo | CopyHaunt |
|---|---|
| Permissões | uma: `storage` |
| Regras de rede declarativas | nenhuma — o Spike 1 mediu que o CDN de mídia responde `Access-Control-Allow-Origin: *` |
| Backend | nenhum; a config remota é um JSON estático no próprio repositório |
| Permissão `downloads` | dispensada: blob mais âncora |
| Preço | gratuito, MIT |

- [ ] **Step 3: Conferir que o README não reintroduz o que a Task 1 tirou**

Nada de identificador de pacote, versão, contagem de usuários ou nome de
constante interna. Comparação de produto, sim; relatório de bundle, não.

---

## Task 3: O histórico — uma decisão, não uma etapa obrigatória

A Task 1 limpa o presente. O passado continua com a análise: ela entrou no
commit que registrou o design, e repositório público expõe o histórico
inteiro.

**Decida uma vez, e siga em frente.** As duas saídas são defensáveis:

**A. Deixar como está.** O histórico de um repositório de portfólio raramente
é escavado, o conteúdo é análise de arquitetura sem código copiado, e o
posicionamento já é declaradamente inspirado. Custo: zero. É a saída padrão
deste plano.

**B. Tirar o spec das revisões antigas**, se você preferir que a análise não
esteja publicada em lugar nenhum:

```bash
python -m pip install git-filter-repo
git clone --no-local . ../copyhaunt-publico
cd ../copyhaunt-publico
git filter-repo --path docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md --invert-paths --prune-empty never
```

O arquivo volta a existir a partir do commit de saneamento da Task 1, já
reescrito. `--prune-empty never` preserva os commits de documentação que
ficariam vazios, para a contagem não cair e a narrativa não perder degraus.

Confira antes de publicar:

```bash
git log --oneline | wc -l   # igual à contagem do repositório de trabalho
git log --all --oneline -- docs/superpowers/specs/ | cat
```

**Não use `--replace-text` para isto.** Trocar termo por termo deixa a análise
inteira no lugar, só com os nomes trocados — quem lê entende igual, e a prosa
fica quebrada.

Escolhendo **B**, a publicação obrigatoriamente vai para um repositório novo:
`push --force` não elimina os objetos antigos do GitHub, que seguem
alcançáveis por SHA.

- [ ] **Step 1: Registrar a escolha aqui, no plano, com a data e o motivo**

---

## Task 4: Publicar

- [ ] **Step 1: Varrer o que não pode ir a público**

```bash
git grep -i -E "api[_-]?key|secret|token|password|Bearer " -- . | head
cat config/config.json
```

Nada de credencial. Os valores de `config/config.json` são operacionais e
públicos por natureza — conferir mesmo assim, uma vez, com os olhos.

- [ ] **Step 2: Abrir**

Escolhida a saída **A** da Task 3, é só trocar a visibilidade do repositório
atual para pública — nenhum repositório novo, nenhum push.

Escolhida a saída **B**:

```bash
gh repo create <nome> --public --description "<a frase de posicionamento>" --source=. --push
```

- [ ] **Step 3: Conferir pelo lado de fora**

Abrir o repositório publicado e procurar, na busca do próprio GitHub, pelo
identificador do pacote e por um dos nomes de constante que a Task 1 removeu.
Esperado: nada.

---

## Verificação final

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
```

## O que este plano NÃO faz

- **Não esconde a inspiração.** É o contrário: ela vira a primeira frase do
  README.
- **Não apaga `refs/`.** O material de consulta continua no disco, fora do
  versionamento.
- **Não trata de marca.** *CopyHaunt* e *referência de mercado* são próximos, no mesmo
  mercado, e o posicionamento aproxima mais ainda. Não é impedimento técnico e
  ninguém aqui é advogado — fica registrado como coisa a decidir antes de
  divulgar amplo.
- **Não publica na Chrome Web Store.** Isso é o bloco E do spec, com
  requisitos próprios: ficha, capturas, política de privacidade.
