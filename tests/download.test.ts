import { describe, expect, it, vi } from 'vitest'
import { baixarCriativos, type Dependencias } from '../src/content/download'
import type { Ad, Midia } from '../src/core/types'

const MP4 = 'https://video.fbcdn.net/v/t42.1790-2/abc.mp4?_nc_cat=1'
const JPG = 'https://scontent.fbcdn.net/v/t45.1600-4/def.jpg?stp=dst-jpg'

function video(alta = MP4): Midia {
  return { formato: 'video', alta, baixa: alta }
}

function imagem(alta = JPG): Midia {
  return { formato: 'imagem', alta, baixa: alta }
}

function ad(midias: Midia[]): Ad {
  return {
    id: '652131454176487',
    iniciouEm: new Date('2026-08-01T00:00:00Z'),
    colacao: 1,
    anunciante: { pageId: '378128628724966', pageName: 'Renan Botelho Dr' },
    midias,
    plataformas: [],
    ativo: true,
  }
}

function corpo(texto: string, ok = true) {
  return { ok, blob: async () => new Blob([texto]) } as unknown as Response
}

function deps(extra: Partial<Dependencias> = {}): Dependencias {
  return {
    buscar: vi.fn(async () => corpo('conteúdo')),
    salvar: vi.fn(),
    ...extra,
  }
}

describe('uma mídia só', () => {
  it('salva o arquivo solto, sem empacotar nada', async () => {
    const d = deps()
    await baixarCriativos(ad([video()]), d)

    expect(d.salvar).toHaveBeenCalledTimes(1)
    const [blob, nome] = (d.salvar as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(nome).toBe('renan-botelho-dr-652131454176487.mp4')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('busca a versão alta, nunca a de pré-visualização', async () => {
    const d = deps()
    await baixarCriativos(
      ad([{ formato: 'video', alta: MP4, baixa: 'https://x/ruim.mp4' }]),
      d,
    )
    expect(d.buscar).toHaveBeenCalledWith(MP4)
  })
})

describe('várias mídias', () => {
  it('empacota tudo num ZIP com o nome do anúncio', async () => {
    const d = deps()
    await baixarCriativos(ad([video(), imagem()]), d)

    expect(d.salvar).toHaveBeenCalledTimes(1)
    const [blob, nome] = (d.salvar as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(nome).toBe('renan-botelho-dr-652131454176487.zip')
    expect((blob as Blob).size).toBeGreaterThan(0)
  })

  it('o ZIP guarda uma entrada por mídia, numeradas', async () => {
    const d = deps()
    await baixarCriativos(ad([video(), imagem()]), d)

    const [blob] = (d.salvar as ReturnType<typeof vi.fn>).mock.calls[0]
    // Os nomes das entradas viajam em claro no cabeçalho do ZIP, porque
    // mídia entra sem compressão.
    const bytes = new Uint8Array(await (blob as Blob).arrayBuffer())
    const texto = new TextDecoder().decode(bytes)
    expect(texto).toContain('01.mp4')
    expect(texto).toContain('02.jpg')
  })

  it('busca todas as mídias', async () => {
    const d = deps()
    await baixarCriativos(ad([video(), imagem()]), d)
    expect(d.buscar).toHaveBeenCalledTimes(2)
  })
})

describe('quando alguma mídia falha', () => {
  it('entrega as que vieram, em vez de desistir de todas', async () => {
    const buscar = vi.fn(async (url: string) =>
      url === MP4 ? corpo('bom') : corpo('ruim', false),
    ) as unknown as typeof fetch
    const d = deps({ buscar })

    await baixarCriativos(ad([video(), imagem()]), d)

    // Sobrou uma: vai solta, não faz sentido um ZIP de um arquivo.
    const [, nome] = (d.salvar as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(nome).toBe('renan-botelho-dr-652131454176487.mp4')
  })

  it('não salva nada, e não lança, quando nenhuma vem', async () => {
    const d = deps({ buscar: vi.fn(async () => corpo('', false)) })
    await expect(baixarCriativos(ad([video(), imagem()]), d)).resolves
      .toBeUndefined()
    expect(d.salvar).not.toHaveBeenCalled()
  })

  it('não lança quando a rede cai', async () => {
    const d = deps({
      buscar: vi.fn(async () => {
        throw new Error('sem rede')
      }),
    })
    await expect(baixarCriativos(ad([video()]), d)).resolves.toBeUndefined()
    expect(d.salvar).not.toHaveBeenCalled()
  })

  it('não faz nada quando o anúncio não tem mídia', async () => {
    const d = deps()
    await baixarCriativos(ad([]), d)
    expect(d.buscar).not.toHaveBeenCalled()
    expect(d.salvar).not.toHaveBeenCalled()
  })
})
