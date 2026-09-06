import { extrairTokenDeSessao } from './sessao'

/**
 * A consulta forjada: o caminho 2 da seção 7 do spec.
 *
 * Esta é a única parte da extensão que **fabrica** um pedido em nome da conta
 * do usuário. Todo o resto apenas escuta o que a página já pediu. O risco foi
 * apresentado por extenso e aceito, e as travas deste arquivo são o que o
 * mantém no mínimo: um pedido, por clique deliberado, por anunciante, por
 * sessão.
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
  /** O HTML de onde sai o `token_de_sessao`. Injetado para testar sem navegador. */
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

/** A requisição em si. Nunca lança: todo fracasso vira `null`. */
async function consultar(
  pageId: string,
  deps: Dependencias,
): Promise<string | null> {
  if (!docIdAtual) return null

  const token = extrairTokenDeSessao(deps.html())
  // Sem sessão não há o que perguntar. Não é erro: é o estado de quem não
  // está logado, e foi medido que não existe versão anônima deste caminho.
  if (!token) return null

  try {
    const resposta = await deps.buscar(GRAPHQL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token_de_sessao: token,
        doc_id: docIdAtual,
        variables: JSON.stringify({ viewAllPageID: pageId }),
      }).toString(),
      credentials: 'omit',
    })
    if (!resposta.ok) return null

    // A Meta às vezes prefixa a resposta com `for (;;);`, defesa antiga contra
    // roubo de JSON. Cortar até a primeira chave custa menos que adivinhar
    // qual das formas veio.
    const texto = await resposta.text()
    const inicio = texto.indexOf('{')
    if (inicio < 0) return null

    const handle = acharIgUsername(JSON.parse(texto.slice(inicio)))
    return handle ? `https://www.instagram.com/${handle}` : null
  } catch {
    // Rede caída, JSON quebrado, resposta truncada: tudo vira silêncio.
    return null
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
