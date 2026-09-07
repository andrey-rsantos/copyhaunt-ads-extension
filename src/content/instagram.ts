import { extrairLsd } from './sessao'
import { PAIS } from '../core/links'

/**
 * A consulta forjada: o caminho 2 da seção 7 do spec.
 *
 * Esta é a única parte da extensão que **fabrica** um pedido. Todo o resto
 * apenas escuta o que a página já pediu. A requisição continua deliberada,
 * limitada a um anunciante por sessão, mas não viaja em nome da conta do
 * usuário.
 *
 * **Somente dados, nunca código.** Nada da resposta é executado.
 */

const GRAPHQL = 'https://www.facebook.com/api/graphql/'

/**
 * O valor que o item do menu carrega quando ainda não se sabe o Instagram.
 *
 * Não é uma URL: é um pedido de busca que só `tray.ts` entende. Existe para o
 * item poder ser clicável sem que `menu.ts` precise saber que há uma consulta
 * atrás dele — o menu continua sabendo apenas "tem valor, logo é clicável".
 */
export const BUSCAR_INSTAGRAM = 'copyhaunt:buscar-instagram'

/**
 * O que já se perguntou nesta sessão.
 *
 * Guarda o fracasso junto com o acerto, e é essa a trava de "uma requisição
 * por anunciante": sem guardar o `null`, o usuário insistindo no clique viraria
 * exatamente a repetição que o spec proíbe.
 *
 * Vive na memória da aba e morre com ela, de propósito. Levar isto para o
 * `storage` seria manter, no disco do usuário, um registro de quais
 * anunciantes ele investigou.
 */
const cache = new Map<string, string | null>()

/**
 * As perguntas ainda sem resposta.
 *
 * O cache só grava quando a resposta chega, e nesse intervalo o item do menu
 * ainda se oferece para buscar. Sem isto, o usuário impaciente que clica duas
 * vezes seguidas dispararia duas requisições — e é justamente ele quem clica
 * duas vezes. Compartilhar a promessa mantém a trava de "uma por anunciante"
 * de pé também durante a espera.
 */
const emVoo = new Map<string, Promise<string | null>>()

/** Zera o cache. Existe para os testes; nada em produção chama. */
export function limparCacheInstagram(): void {
  cache.clear()
  emVoo.clear()
}

/**
 * O `doc_id` vindo da config remota, nunca fixo no código.
 *
 * `undefined` desliga a consulta por completo, e é assim que o recurso é
 * desligado em minutos quando a Meta desregistrar a query: basta apagar o
 * campo do arquivo hospedado.
 */
let docIdAtual: string | undefined

export function definirDocIdAnunciante(id: string | undefined): void {
  docIdAtual = id
}

/**
 * O que já se sabe deste anunciante nesta sessão.
 *
 * `undefined` = nunca perguntamos. `null` = perguntamos e não veio nada, e não
 * se pergunta de novo. Os dois casos são diferentes, e o menu depende dessa
 * diferença para saber se oferece a busca ou mostra o item desabilitado.
 */
export function instagramConhecido(pageId: string): string | null | undefined {
  return cache.get(pageId)
}

export interface Dependencias {
  buscar: typeof fetch
  /** O HTML de onde sai o `lsd`. Injetado para testar sem navegador. */
  html: () => string
}

/**
 * Acha `ig_username` em qualquer profundidade da resposta.
 *
 * O caminho exato dentro de `data` não foi medido, e a Meta reorganiza
 * envelope com frequência. Procurar a chave sobrevive a isso; um caminho fixo
 * errado falharia em silêncio para sempre, que é o pior modo de falha
 * possível para um recurso que já falha em silêncio de propósito.
 *
 * ponytail: varredura ingênua da árvore inteira. A resposta é de um anunciante
 * só e cabe em alguns kilobytes; se algum dia crescer, medir antes de trocar
 * por caminho fixo com queda para a varredura.
 */
function acharIgUsername(no: unknown): string | null {
  if (typeof no !== 'object' || no === null) return null

  for (const [chave, valor] of Object.entries(no)) {
    if (chave === 'ig_username' && typeof valor === 'string' && valor) {
      return valor
    }
    const fundo = acharIgUsername(valor)
    if (fundo) return fundo
  }

  return null
}

/**
 * Diz por que a consulta desistiu.
 *
 * O recurso falha calado de propósito — nada na página da Meta deve mudar
 * quando ele não acha nada. Mas calado para o usuário virou calado também
 * para quem mantém o código, e "desligado pela config" ficou indistinguível
 * de "quebrado pela Meta" justamente no ponto mais frágil da extensão.
 *
 * Nunca inclui o token nem a resposta: só o motivo.
 */
function desistir(motivo: string): null {
  console.info(`[CopyHaunt] instagram: ${motivo}`)
  return null
}

/**
 * As `variables` da consulta, copiadas da requisição real da Biblioteca.
 *
 * Não foram podadas: as tentativas estão no spec, e nenhuma compensou.
 * `fetchPageInfo` e `isAboutTab` são o que resolve `page_info`;
 * `isLandingPage: true` faz a query devolver só o viewer, e `countries` vazio
 * responde 200 sem o campo — falha silenciosa, o pior desfecho possível.
 */
function variaveis(pageId: string) {
  return {
    activeStatus: 'ALL', adType: 'ALL', audienceTimeframe: 'LAST_7_DAYS',
    bylines: [], collationToken: null, contentLanguages: [],
    countries: [PAIS], country: PAIS, deeplinkAdID: null, excludedIDs: [],
    fetchPageInfo: true, fetchSharedDisclaimers: false, hasDeeplinkAdID: false,
    isAboutTab: true, isAudienceTab: false, isLandingPage: false,
    isTargetedCountry: false, location: null, mediaType: 'ALL',
    multiCountryFilterMode: null, pageIDs: [], potentialReachInput: [],
    publisherPlatforms: [], queryString: '', regions: [], searchType: 'PAGE',
    sessionID: crypto.randomUUID(),
    sortData: { mode: 'SORT_BY_TOTAL_IMPRESSIONS', direction: 'DESCENDING' },
    source: null, startDate: null, v: '10d60d', viewAllPageID: pageId,
  }
}

/**
 * Acha o handle num corpo que vem em várias linhas JSON.
 *
 * A Meta responde em streaming: a consulta medida devolveu três linhas, e o
 * campo estava na segunda. Um `JSON.parse` do texto inteiro **lança**. Linha
 * que não parseia é ignorada — cobre também o `for (;;);` que eles às vezes
 * prefixam.
 */
function acharNoCorpo(texto: string): string | null {
  for (const linha of texto.split('\n')) {
    const inicio = linha.indexOf('{')
    if (inicio < 0) continue
    try {
      const achado = acharIgUsername(JSON.parse(linha.slice(inicio)))
      if (achado) return achado
    } catch {
      // Linha truncada ou não-JSON: a próxima pode servir.
    }
  }
  return null
}

/** A requisição em si. Nunca lança: todo fracasso vira `null`. */
async function consultar(
  pageId: string,
  deps: Dependencias,
): Promise<string | null> {
  if (!docIdAtual) return desistir('sem doc_id na config, recurso desligado')

  const lsd = extrairLsd(deps.html())
  if (!lsd) return desistir('sem lsd no HTML, página não reconhecida')

  try {
    const resposta = await deps.buscar(GRAPHQL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        lsd,
        doc_id: docIdAtual,
        variables: JSON.stringify(variaveis(pageId)),
      }).toString(),
      // 'omit' é o ponto inteiro desta mudança: nenhum cookie da conta do
      // usuário viaja. Trocar por 'include' desfaz o ganho de segurança.
      credentials: 'omit',
    })
    if (!resposta.ok) return desistir(`resposta HTTP ${resposta.status}`)

    const handle = acharNoCorpo(await resposta.text())
    if (!handle) return desistir('sem ig_username: anunciante sem Instagram vinculado')
    return `https://www.instagram.com/${handle}`
  } catch (erro) {
    return desistir(`falhou: ${erro instanceof Error ? erro.message : erro}`)
  }
}

/**
 * Devolve o perfil de Instagram do anunciante, ou `null`.
 *
 * **Só chame isto a partir de um clique explícito do usuário.** Chamar durante
 * a mineração, ao plantar a bandeja ou ao abrir o menu romperia a primeira
 * trava do spec e transformaria uma requisição deliberada em tráfego
 * automático na conta do usuário.
 */
export async function buscarInstagram(
  pageId: string,
  deps: Dependencias,
): Promise<string | null> {
  const sabido = cache.get(pageId)
  if (sabido !== undefined) return sabido

  const jaPedido = emVoo.get(pageId)
  if (jaPedido) return jaPedido

  const pedido = consultar(pageId, deps).then((resultado) => {
    cache.set(pageId, resultado)
    emVoo.delete(pageId)
    return resultado
  })
  emVoo.set(pageId, pedido)
  return pedido
}
