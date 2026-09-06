import { diasAtivos, faixaBadge } from '../core/display'
import type { Ad } from '../core/types'
import { criarShadow } from './estilo'

export const ATRIBUTO_ID = 'data-copyhaunt-id'

const BOTOES = [
  { chave: 'baixar', glifo: '⤓', titulo: 'Baixar criativo' },
  { chave: 'copiar', glifo: '⧉', titulo: 'Copiar texto' },
  { chave: 'abrir', glifo: '↗', titulo: 'Abrir links' },
]

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
    bandeja.appendChild(botao)
  }

  const badge = document.createElement('div')
  badge.className = 'badge'
  badge.dataset.faixa = faixaBadge(dias)
  badge.textContent = `${dias} DIAS`

  raiz.append(bandeja, badge)
  shadow.appendChild(raiz)
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
