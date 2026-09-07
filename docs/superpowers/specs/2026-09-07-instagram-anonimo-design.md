# O Instagram do anunciante sem a conta do usuário · Design

**Data:** 2026-09-07
**Substitui:** a seção "O Instagram do anunciante" de
`2026-09-05-copyhaunt-ads-design.md` (caminho 2, travas e análise de risco)
**Motivo:** a afirmação central daquela seção — "não existe versão anônima" —
foi refutada por medição.

## O problema que originou isto

O dono do projeto perguntou se dava para obter o Instagram do anunciante **sem
login no Facebook**, com o objetivo explícito de evitar restrições e
banimentos nas contas de quem usa a extensão.

Até aqui, a extensão fazia a única requisição fabricada de todo o produto
usando `token_de_sessao` e os cookies da conta do usuário. O spec anterior aceitava
esse risco por concluir que não havia alternativa.

## A descoberta

Havia alternativa. A própria Biblioteca de Anúncios dispara a consulta quando
qualquer visitante — **inclusive deslogado** — abre a aba **"Sobre"** de um
anunciante:

```
POST https://www.facebook.com/api/graphql/
doc_id = 26617181747964058
fb_api_req_friendly_name = AdLibraryMobileFocusedStateProviderRefetchQuery
__user = 0
lsd = <token anônimo, extraído do HTML>
variables = { viewAllPageID, isAboutTab: true, fetchPageInfo: true, ... }
```

O campo vive em `data.ad_library_page_info.page_info.ig_username`, e junto vêm
`page_name`, `page_profile_uri`, `profile_photo`, `page_verification` e
`entity_type`.

### Por que a investigação anterior concluiu o contrário

O spec de 2026-09-06 registrou: *"A página do anunciante busca esse dado
sozinha? **não** — só `AdLibraryFoundationRootQuery`,
`useIsAdLibraryPowerUserQuery` e `AdLibraryFilterContextProviderQuery`"*.

As três queries listadas são as do **carregamento** da página do anunciante. A
consulta que traz o Instagram só dispara ao **clicar na aba "Sobre"**, que a
investigação não abriu. A conclusão foi correta para o que foi observado e
errada para a pergunta que respondia — é o modo de falha de medir uma tela
inteira sem interagir com ela.

## O que foi medido

Perfil de navegador dedicado, **sem login**, Chrome 152, Brasil.

| Medição | Resultado |
|---|---|
| Funciona sem sessão | **sim** — HTTP 200 com `ig_username` |
| Funciona com `credentials: 'omit'` | **sim** — nenhum cookie enviado |
| Funciona para anunciante que não está na tela | **sim** — testado com pageId arbitrário |
| Cobertura | **83%** — 15 de 18 anunciantes reais |
| Latência | 1,3 – 3,3 s, mediana ~2 s |
| Tráfego | 78 – 381 KB por anunciante |

Os 18 anunciantes vieram das fixtures: mistura de marcas grandes (Amazon,
Nestlé, Britânia) e produtores individuais (Renan Botelho, Laura Rodrigues,
Nutri.liacastro), que é o público real da extensão.

### A cobertura depende do vínculo declarado, e isso não é regressão

`ig_username` só existe quando o anunciante vinculou a conta do Instagram à
Página. Nos 17% restantes não há o que devolver.

**A consulta antiga tinha exatamente a mesma limitação** — lia o mesmo campo.
Trocar não perde cobertura nenhuma; troca apenas quem paga a conta.

Testado e descartado: veicular anúncios no Instagram **não** prevê o vínculo.
Os três anunciantes sem `ig_username` veiculam no Instagram assim mesmo.

### Otimizações tentadas e descartadas

| Tentativa | Resultado |
|---|---|
| Podar `variables` (`fetchSharedDisclaimers`, `countries`, `activeStatus`) | reduz até ~50% do tráfego, não muda a ordem de grandeza |
| `isLandingPage: true` | 332 ms e 3 KB, mas a query não resolve `page_info` — devolve só o viewer |
| Ler o corpo em streaming e abortar ao achar o campo | **não confiável**: a posição de `ig_username` na resposta varia entre requisições do mesmo anunciante |

Os ~2 s e as ~100 KB são o custo real, e o desenho da interface assume isso.

## A consulta

```js
const lsd = html.match(/"LSD",\s*\[\],\s*\{\s*"token"\s*:\s*"([^"]+)"/)?.[1]

fetch('https://www.facebook.com/api/graphql/', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    lsd,
    doc_id: <da config remota, NUNCA fixo no código>,
    variables: JSON.stringify(variables),
  }),
  credentials: 'omit',
})
```

O conjunto de `variables` que foi medido funcionando, na íntegra. Foi copiado
da requisição real da Biblioteca e **não** foi podado: as tentativas de
enxugá-lo estão na tabela acima, e nenhuma compensou. Reduzir isto depois é
otimização com teste, não limpeza estética.

```js
{
  activeStatus: 'ALL', adType: 'ALL', audienceTimeframe: 'LAST_7_DAYS',
  bylines: [], collationToken: null, contentLanguages: [],
  countries: ['BR'], country: 'BR',          // country: seguir o país da busca
  deeplinkAdID: null, excludedIDs: [],
  fetchPageInfo: true,                        // sem isto, não vem ig_username
  fetchSharedDisclaimers: false,
  hasDeeplinkAdID: false,
  isAboutTab: true,                           // é a aba que resolve page_info
  isAudienceTab: false,
  isLandingPage: false,                       // true faz a query devolver só o viewer
  isTargetedCountry: false, location: null, mediaType: 'ALL',
  multiCountryFilterMode: null, pageIDs: [], potentialReachInput: [],
  publisherPlatforms: [], queryString: '', regions: [],
  searchType: 'PAGE', sessionID: crypto.randomUUID(),
  sortData: { mode: 'SORT_BY_TOTAL_IMPRESSIONS', direction: 'DESCENDING' },
  source: null, startDate: null, v: '10d60d',
  viewAllPageID: pageId,                      // o único campo que varia
}
```

`countries` e `country` devem acompanhar o país da busca em curso, não o
`'BR'` fixo do exemplo — com `countries: []` a consulta responde 200 sem o
campo, o que seria uma falha silenciosa para quem usa a Biblioteca de outro
país.

Três diferenças em relação ao que existe hoje, e todas importam:

| | Hoje | Novo |
|---|---|---|
| Token | `token_de_sessao`, vinculado à conta | `lsd`, anônimo |
| Cookies | `credentials: 'omit'` | `credentials: 'omit'` |
| `doc_id` | `7193625857423421` | `26617181747964058` |

O `doc_id` continua vindo da config remota, com cópia na `CONFIG_EMBUTIDA`. A
peça segue frágil: a Meta rodou a anterior, e vai rodar esta.

## A interface

Decidido com o dono do projeto em 2026-09-07.

**O item permanece sempre no menu, na mesma posição.** A proposta inicial era
o item só aparecer quando existe perfil vinculado, mas isso exigiria pagar os
~2 s **antes** de qualquer clique, em todo card cujo menu fosse aberto. O
custo não se paga: o benefício é cosmético e a espera é real.

**O menu não fecha ao clicar neste item.** Hoje `menu.ts` chama `fecharMenu`
antes de `aoEscolher`, então dois segundos depois não sobraria lugar nenhum
para dar notícia. Mantendo o menu aberto, o próprio item vira o lugar do
feedback — e o projeto não ganha um componente de *toast*, com posicionamento,
temporização e CSS próprios, para exibir uma frase.

Fluxo ao clicar:

1. O item vira `buscando…` e fica sem ação, para o clique repetido não
   disparar nada e o usuário saber que algo acontece.
2. **Achou:** o item vira `Abrir @handle`, e o clique nele abre a aba.
3. **Não achou:** o item vira `sem Instagram vinculado`, desabilitado pelo
   resto da sessão.

Isto corrige o defeito que motivou a investigação: hoje o item apaga sem dizer
nada, e "não tem Instagram" fica indistinguível de "quebrou". Essa era a
queixa real, não a posição do botão.

### Por que o resultado não abre a aba sozinho

Seria o passo natural, e não funciona. Com ~2 s de espera, o `window.open`
roda muito depois do clique, e o Chrome o bloqueia por perda da ativação
transitória — não é hipótese, é a regra do navegador, e a espera longa torna o
caso certo em vez de eventual.

Exigir o segundo clique troca um passo a mais por um comportamento que
funciona sempre, e o segundo clique abre com ativação legítima. O ganho
colateral é que o handle fica visível **antes** de abrir: dá para ver que
`Gratus Tecnologia` publica como `@doutorbeneficiostelemedicina` sem sair da
página, o que para espionagem de oferta vale mais que a aba.

## Travas: o que permanece e o que muda de motivo

| Trava | Status |
|---|---|
| Só em clique explícito, nunca durante mineração | **permanece** |
| Uma requisição por anunciante, cache em memória pela sessão | **permanece** |
| `doc_id` na config remota, nunca fixo no código | **permanece** |
| Falha silenciosa na cara do usuário | **revogada** — vira toast quando não há perfil |

As duas primeiras mudam de **motivo**. Antes protegiam a conta do usuário;
agora protegem contra limite por IP e contra o volume que tornaria o padrão
detectável. O limite é real, a razão é outra.

## O risco residual, sem otimismo

A pergunta que originou isto foi "removemos completamente o risco de
restrições e banimentos?". A resposta honesta é **não completamente**, e o
spec registra o que resta:

1. **O IP continua sendo o do usuário.** A Meta pode limitar por IP e pode
   correlacionar IP com a conta logada em outra aba. É inferência, não
   atribuição.
2. **Os Termos de Uso não distinguem autenticação.** Automação sobre a
   Biblioteca os contraria mesmo anônima. Sem conta identificada não há a quem
   banir; o alvo passa a ser o IP e o padrão da extensão.
3. **O `lsd` sai de um documento logado.** Buscar a Ad Library com
   `credentials: 'omit'` para obter um `lsd` anônimo responde **HTTP 403** —
   testado. O token precisa vir da página aberta, que num usuário logado foi
   carregada com a sessão dele.

O que melhorou de forma qualitativa, e não só quantitativa: a requisição
deixou de ser *"uma conta autenticada gerando tráfego que não corresponde a
nenhuma ação de tela"* — a descrição que o spec anterior usava para o risco. A
consulta nova **é** a ação de tela: idêntica à que a Biblioteca dispara quando
alguém clica em "Sobre".

## Verificação obrigatória antes de implementar

O ponto 3 acima é a única incerteza que sobrou, e tem teste barato — **mas só
funciona com sessão logada**:

> Disparar a consulta com `credentials: 'omit'` numa aba logada e ler
> `data.viewer.actor.__typename` na resposta.
>
> - `LoggedOutUser` → o servidor tratou como anônima apesar do `lsd`. O
>   desenho está validado.
> - `User` → o `lsd` carrega contexto de sessão, a anonimização é parcial e o
>   desenho precisa mudar antes de prosseguir.

Sem esse resultado, a implementação não começa.

## Fora de escopo

- **Buscar no hover** para esconder a latência. Aditivo, entra depois se os
  ~2 s incomodarem no uso real.
- **Busca em lote** para os cards visíveis. Inviável no custo medido: 25 cards
  seriam ~50 s de fila e vários megabytes por rolagem.
- **Política de risco do Bloco B.** A mineração com rolagem automática dispara
  as queries de paginação **dentro da sessão logada**, em ritmo de máquina e
  em volume muito maior que uma consulta por anunciante. É o maior risco de
  conta da extensão, e o item do Instagram é o detalhe perto dele. O dono do
  projeto quer investigar como práticas de mercado tratam ritmo, pausas e teto por sessão **antes** de decidir. Fica pendente, e deve virar
  spec próprio.
