import type { Minerador, Progresso } from '../core/miner'
import type { Ad } from '../core/types'
import { salvarResultadoParcial } from './resultados'

export interface DependenciasControle {
  motor: Minerador
  origem: string
  salvarParcial: (resultado: {
    origem: string
    estado: Progresso['estado']
    salvoEm: Date
    anuncios: Ad[]
  }) => Promise<void>
  agora?: () => Date
}

export interface ControleMineracao {
  /** Pausa e grava a parcial. `true` só depois de a gravação resolver. */
  pausar(): Promise<boolean>
  /** Retoma a partir de `pausado`; a Promise é a do laço, resolve ao terminar. */
  retomar(): Promise<void>
  /** Fim definitivo, com parcial gravada. Daqui não se retoma. */
  interromper(): Promise<boolean>
  /** Grava um checkpoint sem mudar o estado do motor. */
  checkpoint(): Promise<boolean>
  estado(): Progresso['estado']
  resultadosDisponiveis(): boolean
}

/**
 * A sessão de uma mineração: uma por `Minerador`.
 *
 * Só aqui pausa e interrupção viram gravação. O motor não sabe de storage; o
 * cartão não sabe de motor. Sem persistência bem-sucedida, `Ver resultados`
 * segue desabilitado — o cartão não pode fingir (spec, 3).
 */
export function criarControleMineracao(deps: DependenciasControle): ControleMineracao {
  const { motor } = deps
  let disponiveis = false
  let checkpointEmAndamento: Promise<boolean> | null = null

  const gravarParcial = async (): Promise<boolean> => {
    const ok = await salvarResultadoParcial(
      motor.progresso(),
      motor.encontrados(),
      deps.origem,
      { salvar: deps.salvarParcial, agora: deps.agora },
    )
    if (ok) disponiveis = true
    return ok
  }

  const gravarCheckpoint = async (): Promise<boolean> => {
    const progresso = motor.progresso()
    if (progresso.estado !== 'minerando') return false

    const ok = await salvarResultadoParcial(
      progresso,
      motor.encontrados(),
      deps.origem,
      {
        salvar: deps.salvarParcial,
        agora: deps.agora,
        podePersistir: () => motor.progresso().estado === 'minerando',
      },
    )
    if (ok) disponiveis = true
    return ok
  }

  return {
    async pausar() {
      if (motor.progresso().estado !== 'minerando') return false
      motor.parar()
      if (motor.progresso().estado !== 'pausado') return false
      return gravarParcial()
    },
    retomar() {
      if (motor.progresso().estado !== 'pausado') return Promise.resolve()
      return motor.iniciar()
    },
    async interromper() {
      const antes = motor.progresso().estado
      if (antes !== 'minerando' && antes !== 'pausado') return false
      motor.interromper()
      if (motor.progresso().estado !== 'interrompida') return false
      return gravarParcial()
    },
    checkpoint() {
      if (checkpointEmAndamento) return checkpointEmAndamento
      const trabalho = gravarCheckpoint()
      checkpointEmAndamento = trabalho
      trabalho.then(
        () => { if (checkpointEmAndamento === trabalho) checkpointEmAndamento = null },
        () => { if (checkpointEmAndamento === trabalho) checkpointEmAndamento = null },
      )
      return trabalho
    },
    estado: () => motor.progresso().estado,
    resultadosDisponiveis: () => disponiveis,
  }
}
