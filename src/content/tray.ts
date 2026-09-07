import { diasAtivos, faixaBadge } from '../core/display'
import { montarCopias } from '../core/copy'
import { montarDestinos } from '../core/links'
import type { Ad } from '../core/types'
import { criarShadow } from './estilo'
import {
  BUSCAR_INSTAGRAM,
  buscarInstagram,
  instagramConhecido,
} from './instagram'
import { baixarCriativos } from './download'
import { abrirMenu, atualizarItem, fecharMenu, type ItemMenu } from './menu'

export const ATRIBUTO_ID = 'data-copyhaunt-id'

const BOTOES = [
  { chave: 'baixar', glifo: '⤓', titulo: 'Baixar criativo' },
  { chave: 'copiar', glifo: '⧉', titulo: 'Copiar texto' },
  { chave: 'abrir', glifo: '↗', titulo: 'Abrir links' },
]

/**
 * Fecha qualquer menu aberto na página.
 *
 * Um listener por bandeja seriam centenas; este é único e percorre os hosts.
 *
 * ponytail: varre todos os hosts a cada clique, O(n) com n = cards na tela
 * (25 a 60 medidos). Se a grade crescer muito, guardar o host aberto numa
 * variável de módulo e fechar só ele.
 */
let fechamentoLigado = false

function ligarFechamentoGlobal(): void {
  if (fechamentoLigado) return
  fechamentoLigado = true
  document.addEventListener('click', () => {
    for (const host of document.querySelectorAll(`[${ATRIBUTO_ID}]`)) {
      const shadow = (host as HTMLElement).shadowRoot
      if (shadow) fecharMenu(shadow)
    }
  })
}

/**
 * Os destinos do OPEN na forma que o menu entende.
 *
 * O item do Instagram é o único que não sai pronto de `montarDestinos`: lá
 * mora só o que dá para saber sem requisição nenhuma, e quando isso não
 * alcança — 89% dos anúncios medidos — o item vira uma ação em vez de um beco
 * sem saída.
 */
function destinosComoItens(ad: Ad): ItemMenu[] {
  return montarDestinos(ad).map((d) => {
    if (d.chave !== 'instagram' || d.url !== null) {
      return { chave: d.chave, rotulo: d.rotulo, valor: d.url }
    }

    // `undefined` = nunca perguntamos, então ofereça a busca. `null` = já
    // perguntamos e o anunciante não tem. Qualquer string é o perfil achado,
    // e o rótulo mostra o handle antes de abrir.
    const sabido = instagramConhecido(ad.anunciante.pageId)

    if (sabido === undefined) {
      return {
        chave: d.chave,
        rotulo: `${d.rotulo} (buscar)`,
        valor: BUSCAR_INSTAGRAM,
        // Sem isto o menu fecharia no clique, e a resposta que chega ~2 s
        // depois não teria onde aparecer.
        mantemAberto: true,
      }
    }

    if (sabido === null) {
      return { chave: d.chave, rotulo: 'sem Instagram vinculado', valor: null }
    }

    return {
      chave: d.chave,
      rotulo: `Abrir @${sabido.split('/').pop()}`,
      valor: sabido,
    }
  })
}

/**
 * Dispara a consulta e dá a notícia no próprio item do menu.
 *
 * Não abre a aba sozinha de propósito. A consulta leva ~2 s, e a essa altura
 * a ativação transitória do clique já expirou: o `window.open` seria bloqueado
 * como popup, e o caso de sucesso falharia em silêncio. O segundo clique abre
 * com ativação legítima — e, de quebra, o handle fica legível antes de abrir.
 */
function buscarInstagramNoMenu(raiz: ParentNode, ad: Ad): void {
  atualizarItem(raiz, 'instagram', { rotulo: 'buscando…', estado: 'buscando' })

  void buscarInstagram(ad.anunciante.pageId, {
    buscar: (...args) => fetch(...args),
    html: () => document.documentElement.innerHTML,
  }).then((url) => {
    if (!url) {
      atualizarItem(raiz, 'instagram', {
        rotulo: 'sem Instagram vinculado',
        estado: 'apagado',
      })
      return
    }
    atualizarItem(raiz, 'instagram', {
      rotulo: `Abrir @${url.split('/').pop()}`,
      estado: 'achou',
      // A ação precisa vir junto: `atualizarItem` troca a linha por um clone
      // e o listener original morre com ela.
      aoClicar: () => {
        window.open(url, '_blank', 'noopener')
        fecharMenu(raiz)
      },
    })
  })
}

/**
 * Entrega o arquivo ao usuário.
 *
 * Blob mais âncora com `download`, que é o que dispensa a permissão
 * `downloads` — permissão que pesaria na revisão da Web Store por nada.
 */
function salvarArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob)
  const ancora = document.createElement('a')
  ancora.href = url
  ancora.download = nome
  ancora.click()
  // Revogar no próximo tique: revogar na mesma volta do laço de eventos
  // chegaria antes de o navegador terminar de ler a URL.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Baixa os criativos do card, travando o botão enquanto isso.
 *
 * A trava não é enfeite: um carrossel demora, e sem sinal de que algo está
 * acontecendo o usuário clica de novo e baixa tudo duas vezes.
 */
async function baixarDoCard(botao: HTMLElement, ad: Ad): Promise<void> {
  if (botao.dataset.ocupado) return
  botao.dataset.ocupado = 'sim'
  try {
    await baixarCriativos(ad, {
      buscar: (...args) => fetch(...args),
      salvar: salvarArquivo,
    })
  } finally {
    delete botao.dataset.ocupado
  }
}

/**
 * Planta a bandeja e o badge no card.
 *
 * Idempotente por desenho: a Meta recicla nós durante a rolagem, e o mesmo
 * elemento pode reaparecer com outro anúncio. O host carrega o ID que
 * plantou; replantar com ID diferente troca o conteúdo em vez de duplicar.
 */
export function plantarBandeja(
  card: HTMLElement,
  ad: Ad,
  agora: Date,
): void {
  const existente = card.querySelector<HTMLElement>(`[${ATRIBUTO_ID}]`)
  if (existente?.getAttribute(ATRIBUTO_ID) === ad.id) return

  // A bandeja é posicionada de forma absoluta sobre o card, o que exige um
  // ancestral posicionado. Se a Meta já posicionou, não mexemos.
  if (getComputedStyle(card).position === 'static') {
    card.style.position = 'relative'
  }

  const host = existente ?? document.createElement('div')
  host.setAttribute(ATRIBUTO_ID, ad.id)
  if (!existente) card.prepend(host)

  const shadow = criarShadow(host)
  const dias = diasAtivos(ad.iniciouEm, agora)

  shadow.querySelector('.raiz')?.remove()
  const raiz = document.createElement('div')
  raiz.className = 'raiz'

  const bandeja = document.createElement('div')
  bandeja.className = 'bandeja'
  for (const b of BOTOES) {
    const botao = document.createElement('div')
    botao.className = 'botao'
    botao.dataset.acao = b.chave
    botao.title = b.titulo
    botao.textContent = b.glifo
    botao.addEventListener('click', (evento) => {
      // A Meta escuta clique no card inteiro: sem isto, abrir o menu abriria
      // o anúncio deles junto.
      evento.stopPropagation()
      evento.preventDefault()

      if (b.chave === 'baixar') {
        void baixarDoCard(botao, ad)
      } else if (b.chave === 'copiar') {
        abrirMenu(raiz, montarCopias(ad), (item) => {
          if (item.valor) void navigator.clipboard.writeText(item.valor)
        })
      } else if (b.chave === 'abrir') {
        abrirMenu(raiz, destinosComoItens(ad), (item) => {
          if (!item.valor) return
          if (item.valor === BUSCAR_INSTAGRAM) {
            buscarInstagramNoMenu(raiz, ad)
            return
          }
          // `noopener`: a aba aberta não recebe referência para esta.
          window.open(item.valor, '_blank', 'noopener')
        })
      }
    })
    bandeja.appendChild(botao)
  }

  const badge = document.createElement('div')
  badge.className = 'badge'
  badge.dataset.faixa = faixaBadge(dias)
  badge.textContent = `${dias} DIAS`

  raiz.append(bandeja, badge)
  shadow.appendChild(raiz)
  ligarFechamentoGlobal()
}

/**
 * Esconde o card reprovado, destaca o aprovado.
 *
 * O destaque é `outline`, nunca `border`: border ocupa espaço e empurraria
 * todos os cards da grade em dois pixels.
 */
export function aplicarVeredito(card: HTMLElement, passa: boolean): void {
  if (passa) {
    card.style.display = ''
    card.style.outline = '2px solid #7C3AED'
    card.style.outlineOffset = '-2px'
    card.style.boxShadow = '0 0 20px rgba(124, 58, 237, 0.18)'
    card.style.borderRadius = '14px'
  } else {
    card.style.display = 'none'
  }
}

/** Devolve o card ao estado em que a Meta o entregou. */
export function limparVeredito(card: HTMLElement): void {
  card.style.display = ''
  card.style.outline = ''
  card.style.outlineOffset = ''
  card.style.boxShadow = ''
  card.style.borderRadius = ''
}
