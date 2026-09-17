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
    botao.textContent = e.glifo
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
