import type { ControleMineracao } from './controle-mineracao'

type Visibilidade = 'hidden' | 'visible'

/**
 * Isola os eventos de ciclo de vida do DOM do controle da sessão.
 *
 * O evento só dispara um checkpoint best-effort. Ele nunca pausa ou
 * interrompe o motor e não espera a Promise para bloquear o descarregamento.
 */
export function criarCicloMineracao(
  obterControle: () => Pick<ControleMineracao, 'checkpoint'> | null,
): {
  aoMudarVisibilidade: (estado: Visibilidade) => void
  aoPagehide: () => void
} {
  let oculto = false

  const tentarCheckpoint = (): void => {
    if (oculto) return
    const controle = obterControle()
    if (!controle) return
    oculto = true

    try {
      void Promise.resolve(controle.checkpoint()).catch(() => {})
    } catch {
      // pagehide é best-effort: não há consumidor para um erro síncrono aqui.
    }
  }

  return {
    aoMudarVisibilidade: (estado) => {
      if (estado === 'visible') {
        oculto = false
        return
      }
      tentarCheckpoint()
    },
    aoPagehide: tentarCheckpoint,
  }
}
