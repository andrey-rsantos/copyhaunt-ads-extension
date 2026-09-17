import { describe, expect, it, vi } from 'vitest'
import { relogioDeTeste } from '../src/core/clock'
import { CRITERIOS_PADRAO, type Criterios } from '../src/core/criteria'
import { Minerador, type OpcoesMineracao } from '../src/core/miner'
import { AdStore } from '../src/core/store'
import type { Ad } from '../src/core/types'

const AGORA = new Date('2026-09-06T12:00:00Z')

function ad(id: string, colacao: number, pageId = 'p1'): Ad {
  return {
    id,
    iniciouEm: new Date('2026-08-01T12:00:00Z'), // 36 dias
    colacao,
    anunciante: { pageId, pageName: 'A' },
    midias: [],
    plataformas: [],
    ativo: true,
  }
}

/** Sem presença mínima, para os testes isolarem a colação. */
const CRIT: Criterios = { ...CRITERIOS_PADRAO, presencaMinima: null }

function montar(opts: Partial<OpcoesMineracao> = {}) {
  const store = new AdStore()
  const relogio = relogioDeTeste(AGORA)
  const rolar = vi.fn()
  const minerador = new Minerador({
    store,
    criterios: CRIT,
    relogio,
    rolar,
    pisoMs: 1000,
    timeoutMs: 4500,
    jitter: 0,
    aleatorio: () => 0.5,
    maxRolagens: 3,
    limiteEncontrados: 100,
    alturaDaPagina: () => 10000,
    cardsNaTela: () => 30,
    ...opts,
  })
  return { store, relogio, rolar, minerador }
}

async function avancarCiclo(
  relogio: ReturnType<typeof relogioDeTeste>,
  minerador: Minerador,
): Promise<void> {
  await relogio.avancar(1000)
  minerador.avisarLote()
  await Promise.resolve()
  await Promise.resolve()
}

async function cederAoLaco(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('Minerador', () => {
  it('começa parado', () => {
    expect(montar().minerador.progresso().estado).toBe('parado')
  })

  it('rola a página a cada ciclo', async () => {
    const { relogio, rolar, minerador } = montar()
    const p = minerador.iniciar()
    await avancarCiclo(relogio, minerador)
    await avancarCiclo(relogio, minerador)
    await avancarCiclo(relogio, minerador)
    await p
    expect(rolar).toHaveBeenCalledTimes(3)
  })

  it('conclui ao atingir o máximo de rolagens', async () => {
    const { relogio, minerador } = montar({ maxRolagens: 2 })
    const p = minerador.iniciar()
    await avancarCiclo(relogio, minerador)
    await avancarCiclo(relogio, minerador)
    await p
    expect(minerador.progresso().estado).toBe('limite-seguranca')
    expect(minerador.progresso().rolagens).toBe(2)
  })

  it('conta analisados e encontrados conforme os critérios', async () => {
    const { store, relogio, minerador } = montar({ maxRolagens: 1 })
    store.adicionar([ad('1', 5), ad('2', 1), ad('3', 9)])
    const p = minerador.iniciar()
    await avancarCiclo(relogio, minerador)
    await p
    const g = minerador.progresso()
    expect(g.analisados).toBe(3)
    expect(g.encontrados).toBe(2)
  })

  it('encontrados devolve os anúncios aprovados', async () => {
    const { store, relogio, minerador } = montar({ maxRolagens: 1 })
    store.adicionar([ad('1', 5), ad('2', 1)])
    const p = minerador.iniciar()
    await avancarCiclo(relogio, minerador)
    await p
    expect(minerador.encontrados().map((a) => a.id)).toEqual(['1'])
  })

  it('parar interrompe antes do máximo', async () => {
    const { relogio, rolar, minerador } = montar({ maxRolagens: 10 })
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    minerador.parar()
    minerador.avisarLote()
    await Promise.resolve()
    await relogio.avancar(1000)
    await p
    expect(minerador.progresso().estado).toBe('pausado')
    expect(rolar).toHaveBeenCalledTimes(1)
  })

  it('interrompe a sessão e não permite retomada', async () => {
    const { relogio, rolar, minerador } = montar({ maxRolagens: 10 })
    const trabalho = minerador.iniciar()

    await relogio.avancar(1000)
    minerador.interromper()
    await trabalho

    expect(minerador.progresso().estado).toBe('interrompida')
    expect(rolar).toHaveBeenCalledTimes(1)

    const novaTentativa = minerador.iniciar()
    await novaTentativa
    expect(minerador.progresso().estado).toBe('interrompida')
    expect(rolar).toHaveBeenCalledTimes(1)
  })

  it('interrompe uma mineração já pausada', async () => {
    const { relogio, minerador } = montar({ maxRolagens: 10 })
    const trabalho = minerador.iniciar()

    await relogio.avancar(1000)
    minerador.parar()
    await trabalho
    expect(minerador.progresso().estado).toBe('pausado')

    minerador.interromper()
    expect(minerador.progresso().estado).toBe('interrompida')
  })

  it('começa uma sessão ignorando IDs já processados', async () => {
    const { store, relogio, minerador } = montar({
      maxRolagens: 1,
      idsAvaliadosInicialmente: ['antigo'],
    })
    store.adicionar([ad('antigo', 5), ad('novo', 5)])

    const trabalho = minerador.iniciar()
    await avancarCiclo(relogio, minerador)
    await trabalho

    expect(minerador.progresso().analisados).toBe(1)
    expect(minerador.encontrados().map((item) => item.id)).toEqual(['novo'])
  })

  it('conclui ao atingir o limite de encontrados', async () => {
    const aoProgredir = vi.fn()
    const { store, relogio, minerador } = montar({
      maxRolagens: 10,
      limiteEncontrados: 2,
      aoProgredir,
    })
    store.adicionar([ad('1', 5), ad('2', 6), ad('3', 7)])
    const p = minerador.iniciar()
    await avancarCiclo(relogio, minerador)
    await p
    expect(minerador.progresso().estado).toBe('concluido')
    expect(minerador.progresso().encontrados).toBe(2)
    expect(minerador.encontrados().map((a) => a.id)).toEqual(['1', '2'])
    expect(aoProgredir.mock.lastCall?.[0].estado).toBe('concluido')
  })

  it('só aproxima o alvo com anúncios aprovados', async () => {
    const { store, relogio, minerador } = montar({
      maxRolagens: 10,
      limiteEncontrados: 2,
    })
    store.adicionar([ad('1', 1), ad('2', 2), ad('3', 5)])

    const p = minerador.iniciar()
    await avancarCiclo(relogio, minerador)
    expect(minerador.progresso()).toMatchObject({
      estado: 'minerando',
      analisados: 3,
      encontrados: 1,
    })

    store.adicionar([ad('4', 5)])
    await avancarCiclo(relogio, minerador)
    await p
    expect(minerador.progresso()).toMatchObject({
      estado: 'concluido',
      analisados: 4,
      encontrados: 2,
    })
  })

  it.each([0, 101, 1.5, Number.POSITIVE_INFINITY])(
    'rejeita limite de encontrados inválido: %s',
    (limiteEncontrados) => {
      expect(() => montar({ limiteEncontrados })).toThrow(RangeError)
    },
  )

  it('avisa o progresso a cada ciclo', async () => {
    const aoProgredir = vi.fn()
    const { relogio, minerador } = montar({ maxRolagens: 2, aoProgredir })
    const p = minerador.iniciar()
    await avancarCiclo(relogio, minerador)
    await avancarCiclo(relogio, minerador)
    await p
    expect(aoProgredir).toHaveBeenCalledTimes(3)
    expect(aoProgredir.mock.calls[0][0].estado).toBe('minerando')
    expect(aoProgredir.mock.lastCall?.[0].estado).toBe('limite-seguranca')
  })

  it('não conta o mesmo anúncio duas vezes entre ciclos', async () => {
    const { store, relogio, minerador } = montar({ maxRolagens: 2 })
    store.adicionar([ad('1', 5)])
    const p = minerador.iniciar()
    await avancarCiclo(relogio, minerador)
    store.adicionar([ad('1', 5), ad('2', 5)])
    await avancarCiclo(relogio, minerador)
    await p
    expect(minerador.progresso().analisados).toBe(2)
  })

  it('iniciar duas vezes não roda dois laços', async () => {
    const { relogio, rolar, minerador } = montar({ maxRolagens: 2 })
    const a = minerador.iniciar()
    const b = minerador.iniciar()
    await avancarCiclo(relogio, minerador)
    await avancarCiclo(relogio, minerador)
    await Promise.all([a, b])
    expect(rolar).toHaveBeenCalledTimes(2)
  })

  it('a presença do anunciante entra na avaliação', async () => {
    const { store, relogio, minerador } = montar({
      maxRolagens: 1,
      criterios: { ...CRITERIOS_PADRAO, presencaMinima: 2 },
    })
    // Dois anúncios do mesmo anunciante: presença 2, passa.
    store.adicionar([ad('1', 5, 'px'), ad('2', 5, 'px'), ad('3', 5, 'py')])
    const p = minerador.iniciar()
    await avancarCiclo(relogio, minerador)
    await p
    expect(minerador.encontrados().map((a) => a.id)).toEqual(['1', '2'])
  })
})

describe('laço reativo', () => {
  it('não rola de novo antes de o lote chegar', async () => {
    const store = new AdStore()
    const relogio = relogioDeTeste(new Date('2026-09-10T12:00:00Z'))
    const rolar = vi.fn()
    const m = new Minerador({
      store,
      criterios: CRITERIOS_PADRAO,
      relogio,
      rolar,
      pisoMs: 2500,
      timeoutMs: 4500,
      jitter: 0,
      aleatorio: () => 0.5,
      maxRolagens: 10,
      limiteEncontrados: 100,
      alturaDaPagina: () => 10000,
      cardsNaTela: () => 30,
    })

    void m.iniciar()
    await relogio.avancar(2500)
    expect(rolar).toHaveBeenCalledTimes(1)

    await relogio.avancar(2500)
    expect(rolar).toHaveBeenCalledTimes(1)

    m.parar()
  })

  it('rola de novo assim que o lote chega e o piso passa', async () => {
    const store = new AdStore()
    const relogio = relogioDeTeste(new Date('2026-09-10T12:00:00Z'))
    const rolar = vi.fn()
    const m = new Minerador({
      store, criterios: CRITERIOS_PADRAO, relogio, rolar,
      pisoMs: 2500, timeoutMs: 4500, jitter: 0, aleatorio: () => 0.5,
      maxRolagens: 10, limiteEncontrados: 100,
      alturaDaPagina: () => 10000, cardsNaTela: () => 30,
    })

    void m.iniciar()
    await relogio.avancar(2500)
    expect(rolar).toHaveBeenCalledTimes(1)

    m.avisarLote()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await relogio.avancar(2500)
    expect(rolar).toHaveBeenCalledTimes(2)

    m.parar()
  })

  it('o timeout solta o laço quando nenhum lote chega', async () => {
    const store = new AdStore()
    const relogio = relogioDeTeste(new Date('2026-09-10T12:00:00Z'))
    const rolar = vi.fn()
    const m = new Minerador({
      store, criterios: CRITERIOS_PADRAO, relogio, rolar,
      pisoMs: 2500, timeoutMs: 4500, jitter: 0, aleatorio: () => 0.5,
      maxRolagens: 10, limiteEncontrados: 100,
      alturaDaPagina: () => 10000, cardsNaTela: () => 30,
    })

    void m.iniciar()
    await relogio.avancar(2500)
    expect(rolar).toHaveBeenCalledTimes(1)

    await relogio.avancar(4500)
    await Promise.resolve()
    await relogio.avancar(2500)
    expect(rolar).toHaveBeenCalledTimes(2)

    m.parar()
  })

  it('o jitter varia a espera dentro da margem', async () => {
    const store = new AdStore()
    const relogio = relogioDeTeste(new Date('2026-09-10T12:00:00Z'))
    const rolar = vi.fn()
    const m = new Minerador({
      store, criterios: CRITERIOS_PADRAO, relogio, rolar,
      pisoMs: 1000, timeoutMs: 4500,
      jitter: 0.4,
      aleatorio: () => 1,
      maxRolagens: 10, limiteEncontrados: 100,
      alturaDaPagina: () => 10000, cardsNaTela: () => 30,
    })

    void m.iniciar()
    await relogio.avancar(1399)
    expect(rolar).not.toHaveBeenCalled()
    await relogio.avancar(1)
    expect(rolar).toHaveBeenCalledTimes(1)

    m.parar()
  })
})

describe('condições de parada', () => {
  function montar(extra: Partial<OpcoesMineracao> = {}) {
    const store = new AdStore()
    const relogio = relogioDeTeste(new Date('2026-09-10T12:00:00Z'))
    const m = new Minerador({
      store,
      criterios: CRITERIOS_PADRAO,
      relogio,
      rolar: vi.fn(),
      pisoMs: 1000,
      timeoutMs: 2000,
      jitter: 0,
      aleatorio: () => 0.5,
      maxRolagens: 50,
      limiteEncontrados: 100,
      alturaDaPagina: () => 10000,
      cardsNaTela: () => 0,
      ...extra,
    })
    return { m, relogio, store }
  }

  it('declara esgotado quando o lote não vem e a página não cresce', async () => {
    const { m, relogio } = montar({ cardsNaTela: () => 0 })

    void m.iniciar()
    for (let i = 0; i < 2; i++) {
      await relogio.avancar(1000)
      await relogio.avancar(2000)
      await cederAoLaco()
    }

    expect(m.progresso().estado).toBe('esgotado')
  })

  it('não declara esgotado se a página ainda cresce', async () => {
    let altura = 10000
    const { m, relogio } = montar({ alturaDaPagina: () => (altura += 3000) })

    void m.iniciar()
    for (let i = 0; i < 2; i++) {
      await relogio.avancar(1000)
      await relogio.avancar(2000)
      await cederAoLaco()
    }

    expect(m.progresso().estado).toBe('minerando')
    m.parar()
  })

  it('declara incompreensível quando há cards na tela e o store está vazio', async () => {
    const { m, relogio } = montar({ cardsNaTela: () => 30 })

    void m.iniciar()
    for (let i = 0; i < 3; i++) {
      await relogio.avancar(1000)
      await relogio.avancar(2000)
      await cederAoLaco()
    }

    expect(m.progresso().estado).toBe('incompreensivel')
  })

  it('tolera quatro voltas vazias quando o store já recebeu anúncios', async () => {
    const { m, relogio, store } = montar({ cardsNaTela: () => 30 })
    store.adicionar([{
      id: '1',
      iniciouEm: new Date('2026-08-01T12:00:00Z'),
      colacao: 1,
      anunciante: { pageId: 'p1', pageName: 'A' },
      midias: [],
      plataformas: [],
      ativo: true,
    }])

    void m.iniciar()
    for (let i = 0; i < 4; i++) {
      await relogio.avancar(1000)
      await relogio.avancar(2000)
      await cederAoLaco()
    }

    expect(m.progresso().estado).toBe('minerando')

    await relogio.avancar(1000)
    await relogio.avancar(2000)
    await cederAoLaco()
    expect(m.progresso().estado).toBe('esgotado')
  })

  it('interrompe no teto de segurança sem dizer que concluiu', async () => {
    const { m, relogio } = montar({
      maxRolagens: 1,
      alturaDaPagina: () => 13000,
    })

    void m.iniciar()
    await relogio.avancar(1000)
    await relogio.avancar(2000)
    await cederAoLaco()

    expect(m.progresso().estado).toBe('limite-seguranca')
  })
})
