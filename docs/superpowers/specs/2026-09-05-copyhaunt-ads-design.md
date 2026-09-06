# CopyHaunt Ads — Design da extensão MV3

**Data:** 2026-09-05
**Status:** aprovado, aguardando plano de implementação

---

## 1. Contexto e objetivo

CopyHaunt Ads é uma extensão de navegador (Chrome, Manifest V3) que transforma a
Biblioteca de Anúncios da Meta em uma ferramenta de *ad intelligence*.

**Público:** gestores de tráfego e infoprodutores.

**Problema:** hoje a pessoa rola manualmente milhares de anúncios na Biblioteca
tentando identificar, no olho, quais ofertas estão escalando. Não há filtro por
tempo de veiculação, não há como baixar o criativo em qualidade, e os links do
anunciante (site, Instagram, outros anúncios) não são expostos.

**Objetivo do MVP:** encontrar ofertas comprovadamente escaladas em minutos, e
extrair criativo e contexto para modelagem.

A identidade visual está definida em `CopyHaunt-IDV.md` e é normativa: cores,
tipografia (Sora/Inter), raios de borda, glow e ícones Lucide.

---

## 2. Escopo do MVP

### Dentro

| Bloco | Conteúdo |
|---|---|
| **A — Overlay** | bandeja de botões no card, badge de dias ativos, menu OPEN, filtro de data, download em HD |
| **B — Mineração** | rolagem automática, coleta, deduplicação, critérios de escala, painel de progresso |

### Fora (registrado, não descartado)

- **C — Swipe file**: biblioteca local de criativos salvos, tags, exportação
- **D — Contas e cobrança**: login, plano gratuito limitado, plano pago
- **E — Site e publicação**: landing page e ficha na Chrome Web Store
- Botões de compartilhar e de prompts de IA no card
- Suporte a bibliotecas de anúncios de TikTok e YouTube

### Restrições assumidas

- **Sem backend próprio.** Nenhum servidor de aplicação, autenticação ou banco.
  A única dependência externa é um arquivo JSON estático (seção 8).
- **Coleta 100% passiva.** A extensão não emite requisição própria à Meta.
  Ela apenas observa o que a página já pede. Não há exceção a esta regra.

---

## 3. Inspiração e decisões de arquitetura
  
  O projeto foi orientado por referências públicas de mercado e por testes
  independentes. Esta seção registra apenas as decisões do CopyHaunt, sem
  reproduzir código, identificadores internos ou detalhes operacionais de
  terceiros.
  
  A implementação foi desenhada de forma independente, com foco em coleta
  passiva, normalização de dados e interface própria.
  
  ---
  ---

## 4. Spikes executados

### Spike 1 — CORS no fbcdn · RESOLVIDO

Testadas as respostas do CDN a diferentes valores de `Origin`:

| Origin enviado | Resposta |
|---|---|
| `https://www.facebook.com` | `Access-Control-Allow-Origin: https://www.facebook.com` |
| `https://web.facebook.com` | `Access-Control-Allow-Origin: *` |
| `https://evil.example.com` | `Access-Control-Allow-Origin: *` |
| `chrome-extension://…` | `Access-Control-Allow-Origin: *` |
| ausente | `Access-Control-Allow-Origin: *` |

**Conclusão:** o fbcdn é permissivo. Um `fetch()` cross-origin comum baixa a
mídia de qualquer contexto.

**Consequências:** dispensa `host_permissions` no fbcdn, dispensa regra de DNR
para mídia, e dispensa a permissão `declarativeNetRequest`.

Quanto ao CSP que o referência de mercado remove, ambos os motivos têm saída melhor hoje.
Injeção no *main world* usa `world: "MAIN"` no `content_scripts` (Chrome 111 ou
superior), sem tag de script e portanto sem CSP envolvido. E o download roda no
content script, que por estar em mundo isolado não é afetado pelo CSP da página.

### Spike 2 — Contagem global por anunciante · NÃO RESOLVIDO

Requisição anônima à Ad Library retorna **403**; a Meta exige sessão
autenticada. Verificar exigiria um navegador logado, o que não foi possível no
ambiente.

**Não bloqueia o MVP:** a necessidade foi eliminada por decisão de produto
(seção 7, critério de presença).

---

## 5. Arquitetura

Quatro contextos de execução:

```
┌─ Página da Meta · MAIN world ──────────────────────┐
│  interceptor.ts                                    │
│  • patch em XHR.open / XHR.send                    │
│  • remove excluded_ids da query                    │
│  • emite payload cru + URL                         │
└──────────────────────┬─────────────────────────────┘
                       │  window.postMessage
┌──────────────────────▼─────────────────────────────┐
│  Content script · mundo isolado  ← HUB             │
│  • normaliza payload cru em Ad[]                   │
│  • AdStore em memória + índice card↔anúncio        │
│  • aplica critérios: esconde / destaca             │
│  • planta a bandeja de botões em cada card         │
│  • motor de rolagem da mineração                   │
│  • baixa mídia e monta o ZIP                       │
└────┬────────────────────────────┬──────────────────┘
     │ postMessage                │ chrome.runtime
┌────▼──────────────────┐  ┌──────▼──────────────────┐
│  iframe · painel      │  │  Service worker         │
│  React + Tailwind     │  │  • busca/cacheia config │
│  só apresentação      │  │  • IndexedDB            │
└───────────────────────┘  └─────────────────────────┘
```

### Decisões de arquitetura

**O content script é o hub.** O referência de mercado envia os dados do script injetado
diretamente ao iframe. Aqui não: quem precisa do dado é o content script, que
esconde card, destaca borda e planta botão. Passar pelo iframe para voltar seria
um percurso extra no caminho quente.

**O iframe é deliberadamente burro.** Recebe estado pronto (`analisados: 690,
encontrados: 52`) e devolve comandos (`iniciar`, `parar`, `critérios mudaram`).
React nunca participa do fluxo de centenas de anúncios.

**Isolamento por iframe para o painel; Shadow DOM para as bandejas.** Um iframe
por card seria inviável. Cada bandeja tem seu próprio shadow root, e todos
compartilham uma única `CSSStyleSheet` construída via `adoptedStyleSheets` —
isolamento total com custo de memória desprezível.

---

## 6. Fluxo de dados

Pipeline de cinco estágios:

**1. Captura** *(main world)* — XHR interceptado entrega texto cru e URL. Nada é
interpretado aqui.

**2. Roteamento** — por URL e `doc_id`, classifica em: resultado de busca, grupo
de colação, dados de anunciante ou erro de GraphQL.

**3. Normalização** — converte o payload da Meta no tipo interno:

```ts
type Ad = {
  id: string                  // ad_archive_id
  startedAt: Date             // start_date
  collationCount: number      // anúncios usando o mesmo criativo
  advertiser: { pageId: string; pageName: string; instagram?: string }
  destination: string         // link_url real, com UTMs
  media: Array<{ kind: 'video' | 'image'; hd: string; sd: string }>
  platforms: string[]
}
```

**Somente esta camada conhece o formato da Meta.** Todo o resto do sistema fala
`Ad`. Quando o schema mudar, o conserto é em um arquivo. É também o que torna o
estrutura interna do framework viável como adição futura: vira mais uma fonte alimentando o mesmo
normalizador.

**4. Store e ancoragem** — a junção entre nó do DOM e dado é feita pelo **ID da
biblioteca**, que a Meta escreve dentro do próprio card (*"Identificação da
biblioteca: 2366492917183805"*), extraído por expressão regular.

Não se usa a ordem dos elementos: a Meta reordena e recicla nós durante a
rolagem. O ID é a âncora mais estável disponível — é idêntico em todos os
idiomas e a Meta não pode ocultá-lo, por ser obrigação legal de transparência.

Um `WeakMap<HTMLElement, string>` liga nó a anúncio e permite que o coletor de
lixo limpe sozinho quando a Meta descarta um card.

**5. Aplicação** — critérios decidem passa ou não passa; o card recebe borda com
glow roxo ou é escondido; a bandeja de botões é plantada.

### Performance

Três riscos reais numa sessão de centenas de anúncios:

- **guardar payload cru** — normalizar e descartar o original imediatamente
- **escrever no DOM por anúncio** — agrupar em lote dentro de `requestIdleCallback`
- **`MutationObserver` amplo** — observar apenas o container da grade, com
  `subtree` limitado e *debounce*

---

## 7. Componentes

### Bloco A — Overlay

#### A1 · Bandeja de botões

DOM puro, sem framework: são centenas de instâncias. Cada bandeja em seu shadow
root, com folha de estilo construída compartilhada.

| Botão | Ações |
|---|---|
| **Baixar** | criativo principal · escolher criativos · todos (ZIP) |
| **Copiar** | texto principal · título · descrição · URL do site · tudo |
| **OPEN** | menu de links (A3) |

#### A2 · Badge de dias ativos

Calculado de `startedAt`, com cor indicando a leitura:

| Faixa | Cor | Significado |
|---|---|---|
| menos de 7 dias | `#C4A7FF` lavanda | oferta nova, em teste |
| 7 a 30 dias | `#7C3AED` roxo principal | passou do teste |
| mais de 30 dias | `#A855F7` violeta neon com glow | validada, provavelmente lucrativa |

#### A3 · Menu OPEN

Seis destinos, montados a partir do `Ad` normalizado:

- **Site do anúncio** — `destination`
- **Perfil do anunciante** — `facebook.com/{pageId}`
- **Instagram do anunciante** — `instagram.com/{instagram}`
- **Buscar anúncios deste site** — Ad Library filtrada pelo domínio
- **Buscar anúncios deste anunciante** — Ad Library com `view_all_page_id`
- **URL do anúncio na Biblioteca** — permalink

Item sem dado aparece **desabilitado, com o motivo no tooltip**. Ocultar faria o
menu mudar de tamanho a cada card.

#### O Instagram do anunciante não é obtenível passivamente

Medido em 94 anúncios reais, de quatro nichos: `snapshot.instagram_actor_name`
aparece em **zero** deles.

A extensão de referência resolve isso com uma **requisição ativa por
anunciante**. A função que monta o link lê `extraPageInfo.page_info.ig_username`,
protegida por uma trava `isExtraDataFetched`. No mesmo pacote vêm
`ig_followers`, `ig_verification`, `verification_status` e a data de criação da
página.

Isso conflita com a restrição de coleta 100% passiva da seção 2. Três saídas,
e a decisão é de produto:

| Saída | Consequência |
|---|---|
| Manter desabilitado | passividade intacta; o item fica morto quase sempre |
| Buscar **ao clicar** | uma requisição por clique deliberado do usuário, com cache por sessão. Não é varredura: é o usuário pedindo aquele anunciante |
| Remover o item | menu mais honesto, uma funcionalidade a menos |

A segunda preserva o espírito da restrição — o que a seção 2 proíbe é a
extensão **varrer** por conta própria, não responder a um clique. Mas exige
declarar a exceção por escrito, e ela não está declarada hoje.

#### A4 · Filtro de data

Reescreve `start_date[min]` e `start_date[max]` na URL e recarrega. Não simula
cliques no menu de filtros da Meta.

"Ativo há X" tem duas leituras opostas, ambas úteis, e ambas são oferecidas:

| Modo | Parâmetro | Encontra |
|---|---|---|
| **Provadas** | `start_date[max]` = hoje menos X | ofertas sobreviventes |
| **Subindo** | `start_date[min]` = hoje menos X | ofertas novas em ascensão |

Presets: 3 dias, 5 dias, 1, 2, 3 e 4 semanas, mais intervalo personalizado.

#### A5 · Download em HD

`video_hd_url` para vídeo, `original_image_url` para imagem. Múltiplos criativos
viram ZIP (JSZip), salvo por blob e âncora com `download` — dispensando a
permissão `downloads`, que pesa na revisão da Web Store.

### Bloco B — Motor de mineração

Máquina de estados: `parado → minerando → pausado → concluído`.

Ciclo:

1. garantir a ordenação por impressões totais na URL, para que os anúncios mais
   veiculados apareçam primeiro
2. rolar uma altura de viewport
3. aguardar anúncios chegarem pelo interceptador, com timeout
4. normalizar, aplicar critérios, atualizar contadores
5. repetir até: fim dos resultados, limite atingido, parada manual ou tempo
   esgotado

**Timers em Web Worker.** O Chrome estrangula `setTimeout` em aba não focada.
Implementação própria de cerca de 30 linhas, em vez de dependência externa.

#### Critérios de escala

```
☑ Criativo repetido      ≥ [ 5 ] anúncios
☑ Ativo há               [ 7 ] a [ 90 ] dias
☑ Presença do anunciante ≥ [ 10 ] anúncios nesta busca
```

Todos configuráveis e desligáveis individualmente.

#### O padrão de colação, medido

Distribuição real em 94 anúncios, quatro nichos, ordenados por impressões:

| Corte | Anúncios que passam |
|---|---|
| ≥ 1 | 100% |
| ≥ 2 | 49% |
| ≥ 3 | 33% |
| **≥ 5** | **18%** |
| ≥ 10 | 1% |

Máximo observado: 14.

O padrão de **≥ 5 se confirma**: deixa passar cerca de um em cada cinco, que é
filtro apertado sem ser estéril. Já ≥ 10 derruba quase tudo e só serve como
ajuste manual para quem procura o topo absoluto.

Ressalva: a amostra vem das primeiras páginas de quatro buscas. Nichos com
disputa mais agressiva devem ter colação maior.

**Presença do anunciante** conta quantos anúncios de cada `pageId` apareceram
**nesta sessão de busca** — não o total global do anunciante.

Justificativa: o total global inclui anúncios de outros produtos e outros
países. A presença mede se o anunciante está investindo pesado **no nicho
pesquisado**, que é a pergunta real ao modelar oferta. Além disso, o dado já vem
em cada anúncio: custo zero, nenhuma requisição, e o desenho permanece passivo.

#### Critérios avaliados e adiados

Três sinais foram considerados para o MVP e ficaram para a v2. Todos custam
zero, pois derivam de dados que já passam pela sessão. O motivo do adiamento é
de produto, não técnico: cada checkbox a mais é uma decisão que o usuário
precisa tomar **antes** de conseguir minerar. Um painel pesado na estreia faz
com que a mineração nunca seja ligada.

**Domínio de destino compartilhado.** Quantos anunciantes distintos apontam para
o mesmo destino. Detecta exército de afiliados, que só se forma em oferta que
converte. É o único candidato que mede o mercado em vez de um anunciante
isolado, e por isso o mais promissor dos três. Ressalva: perde força quando os
anunciantes usam checkout de plataforma compartilhada — agrupar por um domínio
de plataforma juntaria o mercado inteiro. Exigiria lista de exclusão das
plataformas conhecidas, ou agrupamento por domínio mais início do caminho.

**Aceleração do anunciante.** Quantos anúncios ele estreou nos últimos dias.
Responde "está escalando agora?" em vez de "já escalou?", separando oferta com
verba entrando hoje daquela que já passou do pico.

**Variação criativa.** Quantos criativos distintos, em oposição a cópias, o
anunciante mantém. Complementa o critério de criativo repetido: repetição alta
indica que duplicaram o vencedor; variação alta indica teste de ângulos. Mede
maturidade da operação, não lucratividade — o mais fraco dos três.

---

## 8. Config remota

Arquivo **JSON estático** hospedado gratuitamente (GitHub Pages ou Cloudflare
Pages). Sem servidor de aplicação.

```json
{
  "version": 7,
  "searchDocIds": ["6622080967917089"],
  "collationDocIds": ["7822800761110468"],
  "fieldPaths": { "collationCount": ["..."] },
  "anchors": { "libraryIdPattern": "\\b\\d{15,17}\\b" }
}
```

Buscado uma vez por sessão, cacheado com validade, com queda para a cópia
embutida em caso de falha. **Somente dados, nunca código** — em conformidade com
a proibição de código remoto do MV3.

**Este item é requisito de MVP, não melhoria futura.** Sem ele, cada mudança da
Meta deixa a base instalada quebrada pelos dias que a revisão da Chrome Web Store
levar. Com ele, a correção chega em minutos.

---

## 9. Resiliência e tratamento de erro

### O modo de falha que importa

Não é a extensão quebrar visivelmente. É ela **parecer funcionar e não coletar
nada** — o usuário busca, nada aparece, e conclui que não existem bons anúncios.

**Detector de degradação:** se houve várias rolagens, o DOM apresenta cards e a
captura foi **zero**, a extensão declara "não estou entendendo a página", com
ação de reportar. Falha barulhenta, nunca silenciosa.

### Degradação em camadas

1. **`doc_id` conhecido** — caminho normal
2. **`doc_id` desconhecido, mas a resposta contém `search_results_connection`** —
   aceita mesmo assim, reconhecendo pelo conteúdo. É o que sustenta a extensão
   quando a Meta troca os identificadores
3. **DOM** — ID da biblioteca e dias ativos. Perde HD e links, mas não fica cega
4. **estrutura interna do framework** — fase 2

### Isolamento por anúncio

Cada anúncio é normalizado isoladamente. Um card com formato inesperado não pode
derrubar o lote inteiro.

### Erros da Meta

Resposta de GraphQL contendo `errors` pausa a mineração com *backoff* e informa
o usuário. Nunca reenviar em laço.

---

## 10. Estratégia de testes

O recurso central é **gravar payloads reais em arquivo**. Com fixtures, o
normalizador — a peça mais crítica — é testado sem navegador, em milissegundos.

| Alvo | Como |
|---|---|
| Normalizador | Vitest sobre fixtures reais |
| Critérios de filtro | testes puros, sem DOM |
| Montagem de URL | datas para os parâmetros de intervalo, virada de mês e fuso |
| Cálculo de dias | hoje, ontem, ano bissexto |
| Ancoragem no card | jsdom sobre HTML salvo da grade |

**Modo gravador:** em desenvolvimento, tudo que o interceptador captura é
despejado em arquivo. Quando a Meta mudar, grava-se fixture nova, rodam-se os
testes e vê-se exatamente o que quebrou.

---

## 11. Manifest e permissões

```json
{
  "manifest_version": 3,
  "permissions": ["storage"],
  "host_permissions": ["*://*.facebook.com/ads/library/*"],
  "content_scripts": [
    {
      "matches": ["*://*.facebook.com/ads/library/*"],
      "js": ["src/interceptor.ts"],
      "world": "MAIN",
      "run_at": "document_start"
    },
    {
      "matches": ["*://*.facebook.com/ads/library/*"],
      "js": ["src/content/index.ts"],
      "run_at": "document_start"
    }
  ]
}
```

O `world: "MAIN"` no primeiro bloco é o que dispensa a remoção do CSP descrita
na seção 4. O `run_at: "document_start"` é obrigatório nos dois: o interceptador
precisa aplicar o patch em `XMLHttpRequest` **antes** de a página fazer a
primeira requisição.

Contra as quatro permissões e dois hosts do referência de mercado. Uma extensão que pede o
mínimo passa mais facilmente pela revisão da Web Store e é mais fácil de o
usuário aceitar.

### Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Build | Vite com CRXJS | HMR dentro da extensão |
| Linguagem | TypeScript | o payload da Meta é complexo demais sem tipos |
| Bandejas no card | DOM puro | centenas de instâncias |
| Painel e popup | React com Tailwind | poucas instâncias, UI complexa |
| Tokens de design | de `CopyHaunt-IDV.md` | cores, Sora/Inter, raios, ícones Lucide |
| Storage | IndexedDB | sessão de mineração e cache |
| Empacotamento de mídia | JSZip | download de múltiplos criativos em um arquivo |
| Testes | Vitest com fixtures | parser testado sem navegador |

---

## 12. Pendências registradas

| # | Item | Situação |
|---|---|---|
| 1 | Contagem global por anunciante | fora do MVP; exigiria requisição ativa. Reavaliar com teste em navegador autenticado |
| 2 | estrutura interna do framework como fonte alternativa | fase 2; complexo, e as camadas 1 a 3 devem bastar |
| 3 | Suporte a Edge e Firefox | Edge deve funcionar sem alteração (Chromium); Firefox exige adaptação de MV3 |
| 4 | Quarto critério de escala | **encerrado.** O MVP fecha com três critérios; os candidatos avaliados estão na seção 7 |
| 5 | Instagram do anunciante | **decisão de produto pendente.** Medido: não vem passivamente em 94 anúncios de quatro nichos. As três saídas estão na seção 7 |
| 6 | Padrão de colação ≥ 5 | **encerrado.** Confirmado com dado real: deixa passar 18% dos anúncios. Distribuição na seção 7 |

---

## 13. Decisões e justificativas

| Decisão | Motivo |
|---|---|
| Coleta passiva, sem requisição própria | tráfego indistinguível do uso humano; sem risco de bloqueio de conta |
| Sem backend no MVP | custo zero, sem operação; licenciamento pode entrar depois sem reescrita |
| Content script como hub | é quem precisa do dado para manipular o DOM |
| Âncora pelo ID da biblioteca | estável entre idiomas e obrigatória por lei |
| Config remota já no MVP | protege a base instalada da revisão lenta da Web Store |
| Presença em vez de total global | responde melhor à pergunta real e mantém o desenho passivo |
| Permissões mínimas | aprovação mais fácil e maior confiança do usuário |
