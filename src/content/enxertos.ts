import { acharLinhaDaBusca } from './barra'
import { criarShadow } from './estilo'
import { observarGrade, type Observacao } from './observer'

/**
 * Os enxertos na barra da Meta.
 *
 * Um host só para os três botões, e não um host por botão: a gaveta precisa
 * de um ponto de ancoragem estável, e três hosts irmãos dariam três.
 *
 * A disciplina de replantio é a mesma da bandeja (`./observer.ts`), pelo
 * mesmo motivo: a Meta reconstrói o DOM sem avisar. Mas há uma diferença
 * medida em 2026-09-10 que vale registrar — a barra **não** é reciclada pela
 * rolagem, ao contrário dos cards. Ela é refeita ao trocar de busca, e a
 * forma dela muda no `resize`.
 */

export const ID_ENXERTOS = 'copyhaunt-enxertos'

export interface Enxerto {
  chave: string
  /** O que aparece no botão. Texto ou glifo. */
  glifo: string
  /** Ícone opcional do botão, desenhado inline para não criar dependência. */
  icone?: 'picareta' | 'interrogacao' | 'calendario'
  /** Não repete o glifo quando o botão é representado apenas pelo ícone. */
  somenteIcone?: boolean
  titulo: string
  /** Papel visual: o calendário é secundário, Minerar é a ação (spec, 7.1). */
  variante: 'contorno' | 'solido'
  aoClicar: (botao: HTMLElement) => void
}

export interface Plantio {
  parar(): void
  /** O host atual, ou null se não houver âncora agora. */
  hospedeiro(): HTMLElement | null
}

const LARGURA_RESPONSIVA = 800

interface EstiloResponsivo {
  linha: HTMLElement
  flexWrap: string
  host: HTMLElement
  flex: string
  justifyContent: string
}

/**
 * Em telas estreitas, a fila da Meta não pode disputar largura com a busca.
 * O host vira uma segunda linha do mesmo container, sem depender da estrutura
 * interna (que muda entre estados autenticado e público).
 */
function aplicarLayoutResponsivo(
  doc: Document,
  linha: HTMLElement,
  host: HTMLElement,
  estilos: Map<HTMLElement, EstiloResponsivo>,
): void {
  const janela = doc.defaultView
  const estreita = (janela?.innerWidth ?? Number.POSITIVE_INFINITY) <= LARGURA_RESPONSIVA
  const flexivel = janela
    ? janela.getComputedStyle(linha).display === 'flex' &&
      janela.getComputedStyle(linha).flexDirection !== 'column'
    : false

  if (estreita && flexivel) {
    if (!estilos.has(linha)) {
      estilos.set(linha, {
        linha,
        flexWrap: linha.style.flexWrap,
        host,
        flex: host.style.flex,
        justifyContent: host.style.justifyContent,
      })
    }

    linha.style.flexWrap = 'wrap'
    host.style.flex = '0 0 100%'
    host.style.justifyContent = 'flex-end'
    return
  }

  const original = estilos.get(linha)
  if (!original) return

  linha.style.flexWrap = original.flexWrap
  host.style.flex = original.flex
  host.style.justifyContent = original.justifyContent
  estilos.delete(linha)
}

function restaurarLayoutResponsivo(estilos: Map<HTMLElement, EstiloResponsivo>): void {
  for (const original of estilos.values()) {
    original.linha.style.flexWrap = original.flexWrap
    original.host.style.flex = original.flex
    original.host.style.justifyContent = original.justifyContent
  }
  estilos.clear()
}

function montarHost(doc: Document, enxertos: Enxerto[]): HTMLElement {
  const host = doc.createElement('div')
  host.id = ID_ENXERTOS

  const shadow = criarShadow(host)
  const fila = doc.createElement('div')
  fila.className = 'fila'

  const divisor = doc.createElement('div')
  divisor.className = 'divisor'
  fila.appendChild(divisor)

  for (const e of enxertos) {
    const botao = doc.createElement('div')
    botao.className = 'botao'
    botao.dataset.chave = e.chave
    botao.dataset.variante = e.variante
    botao.title = e.titulo
    if (e.icone) {
      botao.appendChild(montarIcone(doc, e.icone))
      if (e.somenteIcone) {
        botao.dataset.iconeApenas = 'true'
        botao.setAttribute('aria-label', e.titulo)
      } else {
        const texto = doc.createElement('span')
        texto.textContent = e.glifo
        botao.appendChild(texto)
      }
    } else {
      botao.textContent = e.glifo
    }
    botao.addEventListener('click', (ev) => {
      // A barra da Meta tem os seus próprios listeners; sem isto, clicar no
      // nosso botão também mexe no que está atrás.
      ev.stopPropagation()
      e.aoClicar(botao)
    })
    fila.appendChild(botao)
  }

  shadow.appendChild(fila)
  return host
}

function montarIcone(doc: Document, nome: NonNullable<Enxerto['icone']>): SVGSVGElement {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.dataset.icone = nome
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '16')
  svg.setAttribute('height', '16')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')

  // Ícones geométricos em outline, seguindo a recomendação do IDV.
  const caminhos: Record<NonNullable<Enxerto['icone']>, string[]> = {
    picareta: [
      'M5 21 15.5 10.5',
      'M7 7c3.5-3.5 8.5-4.5 13-2',
      'M7 7c2 2 4 4 6 6',
    ],
    interrogacao: [
      'M9.09 9a3 3 0 1 1 5.83 1c0 2-2.92 2.5-2.92 4',
      'M12 17h.01',
    ],
    calendario: [
      'M8 2v4',
      'M16 2v4',
      'M3 10h18',
      'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    ],
  }

  for (const d of caminhos[nome]) {
    const elemento = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
    elemento.setAttribute('d', d)
    svg.appendChild(elemento)
  }

  return svg
}

/**
 * Planta os enxertos e os mantém plantados.
 *
 * Idempotente: com o host já no lugar certo, não faz nada. Sem âncora, não
 * faz nada e não reclama — spec, 7.7.
 */
export function plantarEnxertos(
  doc: Document,
  enxertos: Enxerto[],
): Plantio {
  let observacao: Observacao | null = null
  let parado = false
  const estilosResponsivos = new Map<HTMLElement, EstiloResponsivo>()

  const plantar = (): void => {
    if (parado) return

    const linha = acharLinhaDaBusca(doc)
    if (!linha) return

    const existente = doc.getElementById(ID_ENXERTOS)
    if (existente?.parentElement === linha) {
      aplicarLayoutResponsivo(doc, linha, existente, estilosResponsivos)
      return
    }

    // Host órfão de um plantio anterior, numa barra que a Meta já descartou.
    existente?.remove()
    const host = montarHost(doc, enxertos)
    linha.appendChild(host)
    aplicarLayoutResponsivo(doc, linha, host, estilosResponsivos)
  }

  plantar()

  // O `body` sobrevive a tudo; a barra, não. Mesmo motivo documentado em
  // `garantirObservador` no content script.
  observacao = observarGrade(doc.body, plantar, 150)
  doc.defaultView?.addEventListener('resize', plantar)

  return {
    parar() {
      parado = true
      observacao?.parar()
      doc.defaultView?.removeEventListener('resize', plantar)
      restaurarLayoutResponsivo(estilosResponsivos)
      doc.getElementById(ID_ENXERTOS)?.remove()
    },
    hospedeiro: () => doc.getElementById(ID_ENXERTOS),
  }
}
