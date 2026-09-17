// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { filtrarPorInstagram } from '../../src/content/pos-instagram'
import {
  abrirPaginaResultados,
  finalizarResultado,
  urlDaPaginaResultados,
} from '../../src/content/resultados'
import type { ResultadoLocal } from '../../src/core/resultados'
import type { Ad } from '../../src/core/types'

function ad(id = 'ad-1'): Ad {
  return {
    id,
    iniciouEm: new Date('2026-09-10T12:00:00Z'),
    colacao: 1,
    anunciante: { pageId: 'page-1', pageName: 'Anunciante 1' },
    midias: [],
    plataformas: ['Facebook'],
    ativo: true,
  }
}

describe('atalho da página de resultados', () => {
  it('usa o recurso da própria extensão', () => {
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: vi.fn(() => 'chrome-extension://id/src/resultados/index.html'),
      },
    })

    expect(urlDaPaginaResultados()).toBe(
      'chrome-extension://id/src/resultados/index.html',
    )
  })

  it('pede ao service worker que abra a página, sem window.open', () => {
    const enviar = vi.fn()
    vi.stubGlobal('chrome', { runtime: { sendMessage: enviar } })
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null)

    abrirPaginaResultados()

    expect(enviar).toHaveBeenCalledWith({ tipo: 'abrir-resultados' })
    expect(abrir).not.toHaveBeenCalled()
    abrir.mockRestore()
  })

  it('salva somente depois do pós-filtro e preserva o Instagram encontrado', async () => {
    const aprovado = ad()
    const salvar = vi.fn(async (_resultado: ResultadoLocal) => {})
    const liberar = vi.fn()
    let liberarFiltro!: () => void
    const filtroTerminou = new Promise<void>((resolve) => {
      liberarFiltro = resolve
    })

    const trabalho = finalizarResultado(
      { estado: 'esgotado', analisados: 1, encontrados: 1, rolagens: 1 },
      [aprovado],
      'https://www.facebook.com/ads/library/?q=receitas',
      {
        filtrar: async (anuncios) => {
          await filtroTerminou
          return filtrarPorInstagram(anuncios, {
            consultar: async () => 'https://www.instagram.com/oficial',
            esperar: async () => {},
          })
        },
        salvar,
        liberar,
      },
    )

    expect(salvar).not.toHaveBeenCalled()
    liberarFiltro()
    await trabalho

    expect(salvar).toHaveBeenCalledTimes(1)
    expect(salvar.mock.calls[0][0].anuncios[0].anunciante.instagram).toBe(
      'https://www.instagram.com/oficial',
    )
    expect(liberar).toHaveBeenCalledTimes(1)
  })

  it('não grava quando a mineração termina pausada', async () => {
    const salvar = vi.fn(async () => {})

    await finalizarResultado(
      { estado: 'pausado', analisados: 0, encontrados: 0, rolagens: 0 },
      [ad()],
      'https://exemplo.test',
      { salvar },
    )

    expect(salvar).not.toHaveBeenCalled()
  })
})
