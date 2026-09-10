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

  const plantar = (): void => {
    if (parado) return

    const linha = acharLinhaDaBusca(doc)
    if (!linha) return

    const existente = doc.getElementById(ID_ENXERTOS)
    if (existente?.parentElement === linha) return

    // Host órfão de um plantio anterior, numa barra que a Meta já descartou.
    existente?.remove()
    linha.appendChild(montarHost(doc, enxertos))
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
      doc.getElementById(ID_ENXERTOS)?.remove()
    },
    hospedeiro: () => doc.getElementById(ID_ENXERTOS),
  }
}
