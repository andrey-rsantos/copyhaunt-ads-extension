import { describe, expect, it } from 'vitest'
import {
  CHAVE_AVALIACAO,
  INTERVALO_AVALIACAO_MS,
  considerarPedidoAvaliacao,
  desativarPedidoAvaliacao,
  type StorageAvaliacao,
} from '../src/core/avaliacao'

const AGORA = new Date('2026-09-19T12:00:00Z')

function mapaStorage(inicial: Record<string, unknown> = {}): StorageAvaliacao {
  const mapa = new Map(Object.entries(inicial))
  return {
    get: async (chave) => mapa.get(chave),
    set: async (chave, valor) => {
      mapa.set(chave, valor)
    },
  }
}

describe('pedido de avaliação', () => {
  it('registra o primeiro uso sem mostrar o pedido imediatamente', async () => {
    const storage = mapaStorage()

    await expect(considerarPedidoAvaliacao(AGORA, storage)).resolves.toBe(false)

    await expect(storage.get(CHAVE_AVALIACAO)).resolves.toEqual({
      versao: 1,
      primeiroUsoEm: AGORA.toISOString(),
      naoMostrarNovamente: false,
    })
  })

  it('mostra depois de cinco dias e reinicia o intervalo a partir do pedido', async () => {
    const primeiroUso = new Date(AGORA.getTime() - INTERVALO_AVALIACAO_MS)
    const storage = mapaStorage({
      [CHAVE_AVALIACAO]: {
        versao: 1,
        primeiroUsoEm: primeiroUso.toISOString(),
        naoMostrarNovamente: false,
      },
    })

    await expect(considerarPedidoAvaliacao(AGORA, storage)).resolves.toBe(true)
    await expect(storage.get(CHAVE_AVALIACAO)).resolves.toEqual({
      versao: 1,
      primeiroUsoEm: primeiroUso.toISOString(),
      ultimoPedidoEm: AGORA.toISOString(),
      naoMostrarNovamente: false,
    })

    const antesDoProximoIntervalo = new Date(
      AGORA.getTime() + INTERVALO_AVALIACAO_MS - 1,
    )
    await expect(
      considerarPedidoAvaliacao(antesDoProximoIntervalo, storage),
    ).resolves.toBe(false)
  })

  it('não mostra quando o usuário desativou o lembrete', async () => {
    const storage = mapaStorage({
      [CHAVE_AVALIACAO]: {
        versao: 1,
        primeiroUsoEm: new Date(
          AGORA.getTime() - INTERVALO_AVALIACAO_MS * 2,
        ).toISOString(),
        naoMostrarNovamente: true,
      },
    })

    await expect(considerarPedidoAvaliacao(AGORA, storage)).resolves.toBe(false)
  })

  it('persiste a escolha de não mostrar novamente', async () => {
    const storage = mapaStorage({
      [CHAVE_AVALIACAO]: {
        versao: 1,
        primeiroUsoEm: AGORA.toISOString(),
        naoMostrarNovamente: false,
      },
    })

    await desativarPedidoAvaliacao(storage)

    await expect(storage.get(CHAVE_AVALIACAO)).resolves.toEqual({
      versao: 1,
      primeiroUsoEm: AGORA.toISOString(),
      naoMostrarNovamente: true,
    })
  })
})
