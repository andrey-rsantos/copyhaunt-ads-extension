import { describe, expect, it, vi } from 'vitest'
import { criarControleMineracao } from '../../src/content/controle-mineracao'
import type { Minerador, Progresso } from '../../src/core/miner'
import type { Ad } from '../../src/core/types'

const ORIGEM = 'https://www.facebook.com/ads/library/?q=receitas'

function ad(id: string): Ad {
  return {
    id,
    iniciouEm: new Date('2026-09-10T12:00:00Z'),
    colacao: 1,
    anunciante: { pageId: 'p1', pageName: 'A' },
    midias: [],
    plataformas: [],
    ativo: true,
  }
}

/** Um motor de mentira, com o contrato que o controle consome e nada mais. */
function montarMotorFalso(aprovados: Ad[]) {
  let estado: Progresso['estado'] = 'minerando'
  const motor = {
    progresso: vi.fn(() => ({
      estado,
      analisados: aprovados.length,
      encontrados: aprovados.length,
      rolagens: 1,
    })),
    encontrados: vi.fn(() => aprovados),
    parar: vi.fn(() => { estado = 'pausado' }),
    interromper: vi.fn(() => { estado = 'interrompida' }),
    iniciar: vi.fn(async () => { estado = 'minerando' }),
  }
  return {
    motor,
    estadoAtual: () => estado,
    definirEstado: (novo: Progresso['estado']) => { estado = novo },
  }
}

function montar(falso: ReturnType<typeof montarMotorFalso>, salvar = vi.fn(async () => {})) {
  const sessao = criarControleMineracao({
    motor: falso.motor as unknown as Minerador,
    origem: ORIGEM,
    salvarParcial: salvar,
    agora: () => new Date('2026-09-17T12:00:00Z'),
  })
  return { sessao, salvar }
}

describe('controle da sessão', () => {
  it('salva a parcial ao pausar e só libera resultados depois da gravação', async () => {
    const falso = montarMotorFalso([ad('a1')])
    const { sessao, salvar } = montar(falso)

    expect(sessao.resultadosDisponiveis()).toBe(false)
    await expect(sessao.pausar()).resolves.toBe(true)

    expect(falso.estadoAtual()).toBe('pausado')
    expect(salvar).toHaveBeenCalledWith(expect.objectContaining({
      origem: ORIGEM,
      estado: 'pausado',
      anuncios: [expect.objectContaining({ id: 'a1' })],
    }))
    expect(sessao.resultadosDisponiveis()).toBe(true)
  })

  it('não libera resultados quando a gravação parcial falha', async () => {
    const falso = montarMotorFalso([ad('a1')])
    const { sessao } = montar(falso, vi.fn(async () => { throw new Error('quota') }))

    await expect(sessao.pausar()).resolves.toBe(false)
    expect(falso.estadoAtual()).toBe('pausado')
    expect(sessao.resultadosDisponiveis()).toBe(false)
  })

  it('retoma somente a partir de pausado', async () => {
    const falso = montarMotorFalso([])
    const { sessao } = montar(falso)

    await sessao.retomar()
    expect(falso.motor.iniciar).not.toHaveBeenCalled()

    await sessao.pausar()
    await sessao.retomar()
    expect(falso.motor.iniciar).toHaveBeenCalledTimes(1)
    expect(sessao.estado()).toBe('minerando')
  })

  it('interrompe, salva parcial e não permite retomar', async () => {
    const falso = montarMotorFalso([ad('a1')])
    falso.motor.parar()
    const { sessao, salvar } = montar(falso)

    await expect(sessao.interromper()).resolves.toBe(true)
    expect(falso.estadoAtual()).toBe('interrompida')
    expect(salvar).toHaveBeenCalledWith(expect.objectContaining({
      estado: 'interrompida',
    }))
    expect(sessao.estado()).toBe('interrompida')

    await sessao.retomar()
    expect(falso.motor.iniciar).not.toHaveBeenCalled()
  })

  it('não interrompe uma sessão que já terminou', async () => {
    const falso = montarMotorFalso([])
    falso.motor.interromper()
    const { sessao, salvar } = montar(falso)

    await expect(sessao.interromper()).resolves.toBe(false)
    expect(salvar).not.toHaveBeenCalled()
  })

  it('grava checkpoint minerando sem interromper o motor', async () => {
    const falso = montarMotorFalso([ad('a1')])
    const { sessao, salvar } = montar(falso)

    await expect(sessao.checkpoint()).resolves.toBe(true)

    expect(falso.motor.interromper).not.toHaveBeenCalled()
    expect(falso.estadoAtual()).toBe('minerando')
    expect(salvar).toHaveBeenCalledWith(expect.objectContaining({
      estado: 'minerando',
      anuncios: [expect.objectContaining({ id: 'a1' })],
    }))
  })

  it('ignora checkpoint tardio depois de a mineração concluir', async () => {
    const falso = montarMotorFalso([ad('a1')])
    const { sessao, salvar } = montar(falso)
    falso.definirEstado('concluido')

    await expect(sessao.checkpoint()).resolves.toBe(false)

    expect(salvar).not.toHaveBeenCalled()
  })
})
