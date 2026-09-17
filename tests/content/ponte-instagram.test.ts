import { describe, expect, it, vi } from 'vitest'
import { atenderBuscaInstagram } from '../../src/content/ponte-instagram'

describe('atender busca de Instagram', () => {
  it('aguarda configuração antes de consultar', async () => {
    let liberar!: () => void
    const config = new Promise<void>((resolve) => { liberar = resolve })
    const buscar = vi.fn(async () => 'https://www.instagram.com/oficial')

    const resposta = atenderBuscaInstagram(
      { tipo: 'buscar-instagram', pageId: '123' },
      { aguardarConfig: () => config, buscar },
    )

    await Promise.resolve()
    expect(buscar).not.toHaveBeenCalled()
    liberar()

    await expect(resposta).resolves.toEqual({
      ok: true,
      url: 'https://www.instagram.com/oficial',
    })
    expect(buscar).toHaveBeenCalledWith('123')
  })

  it('representa ausência sem inventar URL', async () => {
    await expect(atenderBuscaInstagram(
      { tipo: 'buscar-instagram', pageId: '123' },
      { aguardarConfig: async () => {}, buscar: async () => null },
    )).resolves.toEqual({ ok: true, url: null })
  })

  it('converte falha de conteúdo em resposta controlada', async () => {
    await expect(atenderBuscaInstagram(
      { tipo: 'buscar-instagram', pageId: '123' },
      { aguardarConfig: async () => { throw new Error('config') }, buscar: vi.fn() },
    )).resolves.toEqual({
      ok: false,
      motivo: 'conteudo-indisponivel',
    })

    await expect(atenderBuscaInstagram(
      { tipo: 'buscar-instagram', pageId: '123' },
      { aguardarConfig: async () => {}, buscar: async () => { throw new Error('rede') } },
    )).resolves.toEqual({
      ok: false,
      motivo: 'conteudo-indisponivel',
    })
  })

  it('rejeita comando malformado sem consultar', async () => {
    const buscar = vi.fn()
    await expect(atenderBuscaInstagram(
      { tipo: 'buscar-instagram', pageId: '' },
      { aguardarConfig: async () => {}, buscar },
    )).resolves.toEqual({ ok: false, motivo: 'conteudo-indisponivel' })
    expect(buscar).not.toHaveBeenCalled()
  })
})
