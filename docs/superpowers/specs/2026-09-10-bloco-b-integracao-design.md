# Integração do Bloco B — a mineração que o usuário opera · Design

**Spec anterior:** `2026-09-05-copyhaunt-ads-design.md`
**Supera dele:** a seção 7 "Bloco B — Motor de mineração", nos pontos de
ritmo, critérios e interface. O resto daquele documento continua valendo.

---

## 1. Por que este documento existe

O motor de mineração está escrito, testado e **órfão**. Nada em `src/` importa
`miner.ts` nem `clock.ts`.

Não foi esquecimento de execução: foi um vão entre planos. Quatro planos
consecutivos declararam que a integração não era com eles.

| Plano | O que declara não entregar |
|---|---|
| `2026-09-06-bloco-b-mineracao.md` | "o painel de controle da mineração… vem no plano de acabamento do Bloco A" |
| `2026-09-06-acabamento-bandeja.md` | "…e o painel de controle da mineração" |
| `2026-09-06-acao-dos-botoes.md` | "…e o painel de mineração" |
| `2026-09-06-download-hd.md` | "Download em lote… pertence ao motor de mineração do Bloco B" |

Cada um empurrou a peça adiante e nenhum a assumiu. Este spec assume.

**A lição, registrada para não se repetir:** um plano que declara o que não
entrega precisa nomear **qual plano entrega**. "Vem depois" não é um endereço.

---

## 2. O que a integração entrega

O usuário abre a Biblioteca, define o que procurar, liga a mineração, sai para
fazer outra coisa, e volta para uma tela com os anúncios que passaram no
crivo.

Três peças novas:

1. **Três enxertos na barra da Meta** — o `?`, o calendário e o Minerar
   (seção 7). Substituem o painel de filtro atual
2. **O laço corrigido** — rolagem reativa, no lugar do cronômetro cego
3. **Tela de resultados** — página própria da extensão, fora da Biblioteca

---

## 3. Os filtros, e quem os aplica

A divisão não é cosmética: um filtro que a Meta aplica economiza banda e
tempo; o mesmo filtro do nosso lado obriga a baixar tudo para descartar
depois. **Tudo que a Meta puder filtrar, ela filtra.**

E há um segundo corte, que a seção 7 desenvolve: dos filtros do grupo A, a
extensão só monta **um** — o tempo ativo, no calendário. Os demais o usuário
aplica na barra da própria Meta, e a mineração os **herda** da URL em vigor.

### 3.1 Grupo A — a Meta filtra, na URL

Todos verificados na Biblioteca real em 2026-09-10.

| Filtro | Parâmetro | Valores | Quem monta |
|---|---|---|---|
| Termo | `q` | texto livre: palavra, domínio, URL ou expressão | a Meta |
| País | `country` | código ISO. `PT` aceito no teste | a Meta |
| Status | `active_status` | `active` · `inactive` · `all` | a Meta |
| Formato | `media_type` | `all` · `video` · `image` | a Meta |
| Plataforma | `publisher_platforms[0]` | `facebook` · `instagram` | a Meta |
| **Janela de data** | `start_date[min]` / `[max]` | mín e máx em dias | **nosso calendário** |
| Ordem | `sort_data[mode]=total_impressions` | forçada ao minerar | **nós**, ver 7.6 |

**O termo é passado cru.** Não interpretamos, não montamos sintaxe, não
validamos. É a busca da própria Meta, e ela já resolve o que o usuário
escrever. Medido:

| Termo | Resultados |
|---|---|
| `emagrecimento` | > 50.000 |
| `api.whatsapp.com` | > 50.000 |
| `emagrecimento api.whatsapp.com` | **~20.000** |
| `zxqwkjfhtrbnm123` (controle) | 0 |

**Espaço já é `AND`.** Duas palavras estreitam o resultado, e a busca alcança
o link de destino — a terceira linha devolveu anúncios de emagrecimento que
vendem por WhatsApp. Não usar `and` literal: viraria mais uma palavra buscada.

**`media_type=carousel` não existe.** A Meta reverte para `all` quando
recebe. Ver a seção 9.

### 3.2 Grupo B — nós filtramos, sobre o dado coletado

| Filtro | Fonte | Faixa |
|---|---|---|
| Tempo ativo | `iniciouEm` | mínimo e máximo |
| Criativo repetido | colação — ver seção 4 | mínimo e máximo |
| Anúncios do anunciante | contagem por `pageId` na sessão | mínimo e máximo |
| **Possui Instagram** | consulta ao final, ver seção 6.4 | liga/desliga |

Os três primeiros derivam de dado que já passa pela sessão e **não custam
requisição**. O quarto é a exceção, e a seção 6.4 define onde ele roda para
continuar não sendo varredura.

**Tempo ativo** é par mínimo/máximo em dias, com atalhos de mínimo em
3 · 5 · 14 · 30 · 60. Vive no calendário (seção 7.2). A seção 7.4 registra a
saída dos modos "Provadas" e "Subindo".

**"Anúncios do anunciante" é presença nesta busca**, não o total global dele.
O total global exigiria uma requisição por anunciante, e a seção 2 do spec
anterior proíbe. A distinção precisa aparecer no rótulo do controle, senão o
usuário lê o número errado.

---

## 4. A colação, medida

A preocupação levantada era que a contagem de criativo repetido não viesse
pronta da Meta, exigindo hash perceptual ou comparação de mídia. **Não
exige.** Medido nas 57 fixtures reais do projeto:

| | Cobertura |
|---|---|
| `collation_count` numérico | 49 / 57 — 86% |
| `collation_id` presente | 54 / 57 — 95% |
| **Recuperável combinando os dois** | **95%** |
| Sem nenhum dos dois | 3 / 57 — 5% |

O mecanismo: quando `collation_count` vem `null`, o `collation_id` **continua
vindo**. A Meta grava o número apenas no líder do grupo. Dois anúncios reais
das fixtures:

```
id 1763549691495008 → collation_count: 7     collation_id: 1541173110816865
id 1029490823416399 → collation_count: null  collation_id: 1541173110816865
```

**Regra de derivação:**

1. `collation_count` numérico → usa
2. `null` com `collation_id` → conta os membros do grupo vistos na sessão
3. Sem os dois → colação 1

O passo 2 entrega algo melhor que o dado da Meta: conta o que efetivamente
apareceu na busca, que é a pergunta real ao medir escala num nicho.

**Ficam fora, por desnecessários:** hash perceptual, comparação de thumbnail,
similaridade de vídeo, agrupamento por texto mais mídia. Todos caros e
frágeis, para resolver 5% que já cai em colação 1.

---

## 5. O ritmo

### 5.1 O laço atual está errado

`Minerador.rodar()` espera um intervalo fixo e rola, sem perguntar se o lote
anterior chegou. A seção 7 do spec anterior já mandava o contrário —
*"aguardar anúncios chegarem pelo interceptador, com timeout"* — e o código
não seguiu.

Medido em 2026-09-10, rolando a cada 1,5 s por 247 s:

| Métrica | Valor |
|---|---|
| Rolagens | 162 |
| Lotes recebidos | 83 |
| **Rolagens desperdiçadas** | **79 — 49%** |
| Cards únicos | 806 |
| Tráfego | 4,9 MB |

Metade das rolagens não trouxe nada, porque a Meta responde mais devagar do
que o cronômetro dispara.

### 5.2 O laço correto

Rolar, **aguardar o lote com timeout**, e só então rolar de novo. O ritmo
passa a ser ditado pela Meta.

Três propriedades saem de graça dessa inversão:

| Ganho | Como |
|---|---|
| Auto-limitação | Meta lenta ⇒ desaceleramos sozinhos, sem regra nova |
| Fim dos resultados | rolou, esperou o timeout, nada chegou e a página não cresceu |
| Detector de degradação | cards no DOM e store vazio ⇒ "não estou entendendo a página" |

### 5.3 Os números

Intervalo entre lotes da Meta, medido: **mín 1,4 s · mediana 3,0 s · máx 4,5 s**.

| Parâmetro | Valor | Origem |
|---|---|---|
| Timeout de espera do lote | 4,5 s | o máximo observado |
| Piso entre rolagens | 2,5 s | abaixo da mediana medida |
| Jitter | ±40% | cadência rígida denuncia automação |

**Os três vivem na config remota**, com fallback embutido, validados campo a
campo como já se faz com `advertiserDocId`. Se a Meta apertar o cerco, a base
instalada desacelera pela edição de um JSON, sem esperar revisão da loja — que
é o propósito declarado da config remota na seção 8 do spec anterior.

O relógio de Web Worker foi testado na página da Meta em 2026-09-10:
**funciona**, sem CSP no caminho.

---

## 6. Risco, e a postura assumida

### 6.1 O que nos protege

**O motor não emite requisição.** Quem pede os anúncios é a página; nós lemos
o que passa. Não há tráfego nosso para a Meta atribuir a ninguém. A restrição
da seção 2 do spec anterior continua absoluta.

**A Biblioteca é pública.** Não exige login — confirmado em 2026-09-10, com a
medição inteira rodando deslogada. Sem sessão, não há conta a punir, e o pior
caso vira CAPTCHA ou limite por IP, ambos temporários.

Uma decisão federal de janeiro de 2024 sustenta que raspar dados públicos da
Ad Library **deslogado** não viola os Termos da Meta. A proteção está no
"deslogado": logado, vale o contrato que a conta aceitou.

### 6.2 A interface não fala de risco

A extensão funciona igual com ou sem sessão, porque a Biblioteca é pública.
**O painel não menciona login, conta nem risco** — decisão do dono do projeto
em 2026-09-10: um aviso desses assusta o usuário final sem lhe dar nada para
fazer, já que o comportamento seguro é o padrão de qualquer jeito.

O que protege é o desenho, não o texto: o motor não emite requisição, e a
consulta de Instagram fica fora dele (seção 6.4).

### 6.3 O que não fazemos

**Não sintetizamos eventos de usuário** — mouse, teclado, trajetória. A
proposta foi avaliada e recusada por três razões:

1. **Não funciona.** Todo evento criado por script carrega `isTrusted: false`,
   legível pela página numa linha. Adiciona uma assinatura de automação que
   hoje não existe.
2. **Muda o enquadramento.** Ritmo rápido é tráfego anômalo; evento
   falsificado é circunvenção deliberada de detecção — a categoria que os
   Termos tratam como violação grave.
3. **Custa a loja.** Evento genuinamente confiável exigiria a permissão
   `debugger`, que estoura as permissões mínimas e não passa em revisão.

Nossa rolagem usa `window.scrollBy`, que move a barra de verdade. Não há
`isTrusted` na história — já estamos do lado certo dessa linha.

**Não lemos o pacote de extensões concorrentes.** A decisão de 2026-09-06 no
plano de publicação vale, e o repositório público a torna mais importante, não
menos: ela é o que sustenta a frase *"nenhum código de terceiros foi
reaproveitado"*. O que precisávamos saber foi obtido observando a Biblioteca
em execução.

### 6.4 O Instagram fica fora do motor

Consultar o Instagram do anunciante é a **única exceção** à coleta passiva, e
vale por clique explícito, um anunciante por vez, com cache de sessão.

Como critério de mineração, obrigaria consultar todo anunciante encontrado.
Na medição de 2026-09-10 foram 806 anúncios em 4 minutos — algo como 200
anunciantes distintos, logo **200 requisições forjadas em 4 minutos**. É
exatamente a varredura que a seção 2 proíbe, e a coisa mais arriscada que a
extensão poderia fazer.

**Onde ele entra:** sobre os **aprovados**, ao final. Minerou 806, aprovou 18,
consulta 18. Requisições espaçadas e em ordem de grandeza menor não são
varredura, e o cache existente evita repetição.

Isso vale nos dois caminhos:

- **Toggle "Possui Instagram"** nos critérios da mineração. Ligado, ele roda
  ao fim da varredura, sobre os aprovados, e descarta quem não tiver. O painel
  diz isso em uma linha abaixo do controle: *"Verificado ao final, só nos
  anúncios aprovados — não durante a varredura."*
- **Botão na tela de resultados**, para quem minerou com o toggle desligado e
  quis o dado depois.

**A trava que não pode cair:** o `Minerador` nunca chama a consulta dentro do
laço. Ela roda uma vez, depois de o laço encerrar, sobre a lista final. Se
alguma implementação futura precisar do Instagram *para decidir* se aprova,
o desenho está errado — o critério vira pós-filtro, nunca pré-filtro.

---

## 7. Arquitetura

**O princípio: a Meta filtra o que entra, nós filtramos o que fica.**

Um painel próprio, com mercado, plataforma, formato e status, foi desenhado e
**recusado em 2026-09-10**. Ele reconstruía, pior, controles que a Meta já
oferece e que o usuário já sabe operar — e obrigava a manter duas cópias do
mesmo estado.

```
Biblioteca de Anúncios (aba do usuário)
├── barra de filtros da META ─── define o conjunto na tela
│    └── + 3 enxertos nossos: [?] [calendário] [Minerar]
├── content script ── AdStore ── Minerador ── relógio de Worker
│                       └── pintarGrade: destaca aprovados
└── (a mineração herda a URL que estiver valendo)

Tela de resultados (aba própria da extensão)
└── os aprovados, ordenáveis, com ação de Instagram
```

Aprovado contra `refs/ref-filters.png` quanto aos componentes — steppers,
toggle, slider de faixa —, com a organização mudada de painel único para
enxertos.

### 7.1 Os três enxertos

Nenhum reconstrói o que a Meta faz.

| Enxerto | Onde | Faz |
|---|---|---|
| **`?`** | colado à busca da Meta | abre exemplos de busca |
| **Calendário** | na fila de controles, após os dela | tempo ativo — o filtro que a Meta não oferece direito |
| **Minerar** | ao lado do calendário | abre os critérios e inicia a varredura |

Calendário e Minerar ficam **juntos, separados dos controles da Meta por um
divisor**, para serem lidos como um produto e não como dois enxertos avulsos.
Estilos distintos por papel: o calendário é secundário (contorno), Minerar é a
ação principal (sólido). Os dois na cor da marca.

Só uma gaveta aberta por vez.

### 7.2 O que cada gaveta tem

**`?` — exemplos**, sem regras nem jargão. Ver a seção 7.5.

**Calendário — tempo ativo:**

- slider de faixa com dois pontos, rotulados (`7 dias` / `Sem limite`)
- atalhos `3+ 5+ 14+ 30+ 60+`, que movem o ponto do mínimo
- o botão mostra o filtro em vigor: `7+ dias no ar`, ou `7–30 dias no ar`
- botão **Aplicar na página** — é o único enxerto que reescreve a URL

**Minerar — os três critérios que só nós temos, mais o alvo:**

```
Criativos repetidos      ?     [− 5+ +]
Anúncios do anunciante   ?     [− 10+ +]
Possui Instagram                (———o)
Quantidade de aprovados         [ 100 ]
─────────────────────────────────────────
Vai varrer: emagrecimento kiwify.com ·
            Brasil · Vídeo · Ativos · 7+ dias
─────────────────────────────────────────
[ ▶ Iniciar mineração ]
```

**A linha "Vai varrer" não é decoração.** Ela declara a URL herdada, e é o que
substitui o resumo que o painel próprio tinha. Sem ela, o usuário aperta
Minerar sem perceber que os filtros da Meta estão valendo — e essa herança é o
que faz o desenho inteiro funcionar.

**Quantidade de aprovados é o alvo, não o volume lido.** Aceita inteiros de
1 a 100, começa em 100 e conta somente anúncios que passaram pelos critérios
do motor. Se uma página leva 600 anúncios ao store e 500 são reprovados, o
resultado é 100 — não 600. O lote que cruza o alvo é cortado exatamente nele:
96 seguidos de mais 9 aprovados terminam em 100, nunca 105.

O Instagram continua sendo pós-filtro, pela regra da seção 6.4. Quando o
toggle estiver ligado, a quantidade é o alvo antes dessa consulta e o total
final pode diminuir. Tentar repor cada descarte exigiria continuar a varredura
e consultar anunciantes em série, aproximando o produto da coleta ativa que o
desenho proíbe. A interface precisa dizer: *"Instagram é verificado ao final e
pode reduzir o total."*

### 7.3 O que desaparece, e por quê

| Sai | Motivo |
|---|---|
| Mercado, plataforma, formato, status no nosso painel | são da Meta, na barra dela |
| Campo de termo próprio | é a busca dela; o `?` orienta ali mesmo |
| Botão "Aplicar na página" no minerador | os filtros já estão aplicados; nada a aplicar |
| Linha de resumo `Brasil · Instagram · …` | o estado está visível na barra da Meta; duplicar é dívida |
| Abas, e o painel recolhível de 344 px | não há mais o que abrigar |

Sobram **quatro controles e um botão**, contra doze campos do desenho anterior.

### 7.4 "Provadas" e "Subindo" saem

O filtro de hoje oferece dois modos nomeados: `provadas` (no ar há pelo menos
X) e `subindo` (no ar há no máximo X). **Ambos são substituídos pelo par
mínimo/máximo em dias**, no calendário — decisão de 2026-09-10: os nomes
exigem explicação, e os campos não.

Nada se perde em capacidade, e uma coisa se ganha:

| Antes | Agora |
|---|---|
| Provadas, 7 dias | mín 7, máx vazio |
| Subindo, 7 dias | mín vazio, máx 7 |
| *(impossível)* | mín 7, máx 30 — uma faixa |

`ModoFiltro` deixa de existir em `dateFilter.ts`; `montarUrlFiltro` passa a
receber mínimo e máximo, e escreve `start_date[max]` para o mínimo de dias,
`start_date[min]` para o máximo — a inversão é do domínio, não erro de
digitação: mais dias no ar significa data de início mais antiga.

### 7.5 O campo de busca é o da Meta

Não temos campo próprio. O `?` ao lado abre apenas **exemplos**, e clicar num
deles copia o texto para a busca dela:

```
receitas                     anúncios sobre receitas
receitas api.whatsapp.com    receitas que vendem por WhatsApp
"receita de bolo"            a frase exata, nessa ordem
hotmart.com                  anúncios que levam para a Hotmart
emagrecimento kiwify.com     emagrecimento vendido pela Kiwify
```

**Não há aviso de operadores.** Detectar `and`/`or` e alertar foi proposto e
recusado em 2026-09-10: os exemplos ensinam o padrão certo, e um alerta a mais
pesa contra quem só quer buscar. Fica registrado o que a medição mostrou —
`receitas and api.whatsapp.com` devolve **0 resultados** contra ~9.700 sem o
`and` —, para que a decisão possa ser revista se aparecer relato de usuário.

### 7.6 A ordenação, e a recarga que ela obriga

Os escalados precisam vir primeiro, senão a mineração rola muito mais para
achar o mesmo. Hoje é o filtro de data que força
`sort_data[mode]=total_impressions` na URL.

Sem painel montando URL, **iniciar a mineração passa a verificar a URL em
vigor**: se a ordenação não estiver lá, aplicá-la e recarregar uma vez antes
de começar. A recarga descarta o `AdStore`, que ainda está vazio nesse
momento, então não custa nada — mas o usuário vê a página recarregar ao
apertar Minerar, e isso precisa ser esperado, não surpresa.

### 7.7 Fragilidade: enxertar na UI da Meta

Este é o custo real do desenho, e ele é maior que o do painel flutuante.

Ancorar botões na barra da Meta depende da estrutura dela, que muda sem aviso.
O projeto já vive com isso na bandeja dos cards, e `observer.ts` existe porque
a Meta recicla nós durante a rolagem — a mesma disciplina de replantio se
aplica aqui.

**A regra que torna o risco aceitável: degradar em silêncio.** Se a âncora não
for encontrada, o enxerto simplesmente não aparece, e nada mais quebra. Ajuda
que some é um arranhão; painel que some é um defeito.

**Fallback declarado:** se os enxertos não puderem ser plantados, o minerador
continua acessível — a decisão de onde (bandeja, atalho de teclado, ou um
botão flutuante mínimo) fica para a tarefa que implementar a ancoragem, com o
diagnóstico em mãos.

### 7.8 O contrato de mensagens

Hoje só existe painel → content (`panel-command`). A integração acrescenta o
sentido de volta, para o progresso, e a passagem dos aprovados para a tela de
resultados.

### 7.9 O progresso fica na página

Iniciada a varredura, o botão Minerar dá lugar a um cartão com barra,
contadores (analisados, encontrados, rolagens), *Pausar* e o atalho para a
tela de resultados. Ele fica na página, acima da grade: a mineração é longa, e
o usuário continua rolando a Biblioteca enquanto ela roda.

### 7.10 Limites de segurança

O teto de 100 aprovados limita o resultado, mas não basta para limitar a
coleta: filtros apertados podem exigir centenas de anúncios lidos para achar
100 que passem. Por isso o motor conserva uma segunda trava, independente,
por número máximo de rolagens.

- atingir o alvo encerra como `concluido`;
- acabar a página antes dele encerra como `esgotado` e informa, por exemplo,
  *"37 de 100 encontrados — fim dos resultados"*;
- atingir o teto de rolagens encerra como `limite-seguranca` e informa que a
  busca foi interrompida, nunca que os resultados acabaram;
- CAPTCHA, bloqueio ou página com cards que o interceptador deixou de
  compreender interrompem a sessão de forma barulhenta.

O teto de rolagens não é promessa de volume e não muda quando o usuário pede
menos resultados. Ele existe para impedir uma sessão sem fim e pode ser
recalibrado junto do ritmo se a Meta mudar de comportamento.

---

## 8. A tela de resultados

Os aprovados, com as ações da bandeja já existentes e ordenação por:

- maior tempo ativo
- mais criativos repetidos
- mais anúncios do anunciante

Ordenar é sobre dado local já normalizado — custo trivial.

---

## 9. Fora do escopo, e por quê

| Item | Motivo |
|---|---|
| **Filtro de carrossel** | A Meta não oferece; seria o único formato a custar banda. Não mede escala: 47% da amostra é carrossel, então separa pouco. O dado está em `snapshot.cards` e entra depois sem retrabalho |
| **Aceleração do anunciante** | Fora da lista de filtros essenciais definida pelo dono do projeto em 2026-09-10 |
| **Domínio de destino compartilhado** | Idem |
| **Tem WhatsApp como critério** | Idem. E redundante: o termo de busca já filtra por `api.whatsapp.com` na origem, mais barato |
| **Variação criativa** | Mede tamanho da operação, não lucratividade. O mais fraco dos três candidatos de v2 |
| **Total global do anunciante** | Exigiria requisição por anunciante |
| **Hash perceptual e afins** | Ver seção 4 |
| **Download em lote** | Pertence à bandeja, e o plano de download já o registrou como fora |

---

## 10. Incertezas registradas

| # | Incerteza | Como resolver |
|---|---|---|
| 1 | A Meta pagina com a aba realmente oculta? A medição rodou com a janela minimizada e o laço continuou — 19 lotes em 55 s — mas `visibilityState` nunca virou `hidden`, porque o debugger anexado impede | Teste manual com a extensão instalada, sem CDP. **Primeira tarefa do plano** |
| 2 | Como a Meta classifica um carrossel de vídeos em `media_type`? | Teste de dois minutos, na tarefa do filtro de formato |
| 3 | O teto de `>50.000` resultados é limite de exibição ou de busca? | Só importa se alguém quiser minerar exaustivamente um nicho grande |
| 4 | **Qual âncora estável existe na barra de filtros da Meta?** O desenho da seção 7 depende de plantar três enxertos ali, e a bandeja dos cards usa o ID da biblioteca — que não existe na barra | Levantar na tarefa da ancoragem, antes de desenhar o plantio. Sem âncora boa, vale o fallback da seção 7.7 |

---

## 11. Verificação

Além da suíte, do typecheck, do `verify:build` e do Playwright, a integração
só se dá por pronta com **teste manual na Biblioteca real, em perfil
deslogado**, cobrindo:

1. uma mineração completa até o fim dos resultados;
2. uma pausa e retomada;
3. a tela de resultados com os aprovados;
4. **os três enxertos sobrevivendo à rolagem** — a Meta recicla nós, e um
   enxerto que some depois de dez rolagens é um defeito que só o navegador
   revela;
5. **a recarga da seção 7.6** disparando quando a ordenação não está na URL, e
   **não** disparando quando já está.

A incerteza 1 é condição de entrada, não de saída: se a mineração não
sobreviver à aba oculta, o desenho muda antes de ser escrito.

A incerteza 4 é condição de entrada da parte visual: sem âncora estável, o
plantio na barra não se sustenta e vale o fallback da seção 7.7.
