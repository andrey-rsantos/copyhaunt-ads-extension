// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { plantarBandeja } from '../src/content/tray'
import type { Ad } from '../src/core/types'

function ad(extra: Partial<Ad> = {}): Ad {
  return {
    id: '652131454176487',
    iniciouEm: new Date('2026-08-01T00:00:00Z'),
    colacao: 1,
    anunciante: { pageId: '378128628724966', pageName: 'Renan Botelho Dr' },
    texto: 'O texto do anúncio',
    destino: 'https://exemplo.com/oferta',
    midias: [],
    plataformas: [],
    ativo: true,
    ...extra,
  }
}

function plantar(a: Ad = ad()): ShadowRoot {
  const card = document.createElement('div')
  document.body.appendChild(card)
  plantarBandeja(card, a, new Date('2026-09-06T00:00:00Z'))
  const host = card.querySelector('[data-copyhaunt-id]')!
  return host.shadowRoot!
}

function botao(shadow: ShadowRoot, acao: string): HTMLElement {
  return shadow.querySelector<HTMLElement>(`.botao[data-acao="${acao}"]`)!
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('botão copiar', () => {
  it('abre o menu com os cinco itens de cópia', () => {
    const shadow = plantar()
    botao(shadow, 'copiar').click()
    expect(shadow.querySelectorAll('.menu .item')).toHaveLength(5)
  })

  it('escolher um item escreve o valor na área de transferência', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const shadow = plantar()
    botao(shadow, 'copiar').click()
    shadow.querySelector<HTMLElement>('.item[data-chave="texto"]')!.click()

    expect(writeText).toHaveBeenCalledWith('O texto do anúncio')
    vi.unstubAllGlobals()
  })
})

describe('botão abrir', () => {
  it('abre o menu com os seis destinos', () => {
    const shadow = plantar()
    botao(shadow, 'abrir').click()
    expect(shadow.querySelectorAll('.menu .item')).toHaveLength(6)
  })

  it('escolher um destino abre nova aba, sem passar opener', () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)

    const shadow = plantar()
    botao(shadow, 'abrir').click()
    shadow.querySelector<HTMLElement>('.item[data-chave="perfil"]')!.click()

    expect(open).toHaveBeenCalledWith(
      'https://www.facebook.com/378128628724966',
      '_blank',
      'noopener',
    )
    vi.unstubAllGlobals()
  })
})

describe('botão baixar', () => {
  const MP4 = 'https://video.fbcdn.net/v/t42.1790-2/abc.mp4?_nc_cat=1'

  function comMidia() {
    return ad({ midias: [{ formato: 'video', alta: MP4, baixa: MP4 }] })
  }

  it('busca a mídia em alta e entrega o arquivo ao usuário', async () => {
    const buscar = vi.fn(
      async () => ({ ok: true, blob: async () => new Blob(['x']) }) as unknown as Response,
    )
    vi.stubGlobal('fetch', buscar)

    // jsdom não implementa as URLs de objeto, então elas precisam existir
    // antes de serem espionadas. Só o `createObjectURL` interessa: se ele foi
    // chamado, o arquivo chegou à âncora, que é o que este teste verifica.
    // Não mocke o `click` do protótipo — ele mora em `HTMLElement`, e mockar
    // lá desativaria também o clique no próprio botão da bandeja.
    const criarUrl = vi.fn(() => 'blob:falso')
    URL.createObjectURL = criarUrl
    URL.revokeObjectURL = vi.fn()

    const shadow = plantar(comMidia())
    botao(shadow, 'baixar').click()

    await vi.waitFor(() => expect(criarUrl).toHaveBeenCalled())
    expect(buscar).toHaveBeenCalledWith(MP4)

    vi.unstubAllGlobals()
  })

  it('não abre menu nenhum: baixar é ação direta', () => {
    // Anúncio sem mídia de propósito: assim nada é requisitado, e o teste
    // mede só o que promete medir.
    const shadow = plantar()
    botao(shadow, 'baixar').click()
    expect(shadow.querySelector('.menu')).toBeNull()
  })

  it('não estoura no anúncio sem mídia', () => {
    const shadow = plantar()
    expect(() => botao(shadow, 'baixar').click()).not.toThrow()
  })

  it('ignora o segundo clique enquanto o primeiro não terminou', async () => {
    let liberar!: (r: Response) => void
    const buscar = vi.fn(() => new Promise<Response>((ok) => (liberar = ok)))
    vi.stubGlobal('fetch', buscar)

    const shadow = plantar(comMidia())
    const alvo = botao(shadow, 'baixar')
    alvo.click()
    await vi.waitFor(() => expect(alvo.dataset.ocupado).toBe('sim'))
    alvo.click()

    // Um carrossel demora, e sem trava o usuário impaciente baixaria tudo
    // duas vezes.
    expect(buscar).toHaveBeenCalledTimes(1)

    liberar({ ok: false } as Response)
    await vi.waitFor(() => expect(alvo.dataset.ocupado).toBeUndefined())
    vi.unstubAllGlobals()
  })
})
