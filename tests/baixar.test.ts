import { describe, expect, it } from 'vitest'
import { nomeDoArquivo, nomeDoPacote, nomeNoPacote } from '../src/core/baixar'
import type { Ad, Midia } from '../src/core/types'

function ad(extra: Partial<Ad> = {}): Ad {
  return {
    id: '652131454176487',
    iniciouEm: new Date('2026-08-01T00:00:00Z'),
    colacao: 1,
    anunciante: { pageId: '378128628724966', pageName: 'Renan Botelho Dr' },
    midias: [],
    plataformas: [],
    ativo: true,
    ...extra,
  }
}

function video(alta: string): Midia {
  return { formato: 'video', alta, baixa: alta }
}

function imagem(alta: string): Midia {
  return { formato: 'imagem', alta, baixa: alta }
}

const MP4 = 'https://video.fbcdn.net/v/t42.1790-2/abc.mp4?_nc_cat=1&oh=00_x'
const JPG = 'https://scontent.fbcdn.net/v/t45.1600-4/def.jpg?stp=dst-jpg&oe=1'

describe('nomeDoArquivo', () => {
  it('junta o anunciante ao ID do anúncio, com a extensão da mídia', () => {
    expect(nomeDoArquivo(ad(), video(MP4))).toBe(
      'renan-botelho-dr-652131454176487.mp4',
    )
  })

  it('lê a extensão antes da query, não o fim da URL', () => {
    // A URL do fbcdn termina em parâmetros, e o nome do arquivo não pode
    // herdar nada deles.
    expect(nomeDoArquivo(ad(), imagem(JPG))).toBe(
      'renan-botelho-dr-652131454176487.jpg',
    )
  })

  it('normaliza jpeg para jpg, que é o mesmo arquivo com dois nomes', () => {
    expect(nomeDoArquivo(ad(), imagem('https://x.fbcdn.net/a.JPEG'))).toBe(
      'renan-botelho-dr-652131454176487.jpg',
    )
  })

  it.each([
    ['vídeo', video('https://video.fbcdn.net/v/sem-extensao'), 'mp4'],
    ['imagem', imagem('https://scontent.fbcdn.net/v/sem-extensao'), 'jpg'],
  ])('cai no formato quando a URL de %s não traz extensão', (_c, midia, ext) => {
    expect(nomeDoArquivo(ad(), midia)).toBe(
      `renan-botelho-dr-652131454176487.${ext}`,
    )
  })

  it('tira acento e pontuação do nome do anunciante', () => {
    const a = ad({
      anunciante: { pageId: '1', pageName: 'Ação & Cia. Ltda — Oficial!' },
    })
    expect(nomeDoArquivo(a, video(MP4))).toBe('acao-cia-ltda-oficial-652131454176487.mp4')
  })

  it('não deixa o nome crescer sem limite', () => {
    const a = ad({ anunciante: { pageId: '1', pageName: 'a'.repeat(200) } })
    const nome = nomeDoArquivo(a, video(MP4))
    expect(nome.length).toBeLessThanOrEqual(60)
    expect(nome.endsWith('-652131454176487.mp4')).toBe(true)
  })

  it('usa só o ID quando não sobra nada do nome do anunciante', () => {
    const a = ad({ anunciante: { pageId: '1', pageName: '🔥🔥🔥' } })
    expect(nomeDoArquivo(a, video(MP4))).toBe('652131454176487.mp4')
  })

  it('não deixa o nome terminar em hífen depois do corte', () => {
    const a = ad({
      anunciante: { pageId: '1', pageName: `${'a'.repeat(39)} b c` },
    })
    expect(nomeDoArquivo(a, video(MP4))).not.toContain('--')
    expect(nomeDoArquivo(a, video(MP4))).toMatch(/^[a-z0-9-]+\.mp4$/)
  })
})

describe('nomeNoPacote', () => {
  it('numera a partir de 1, com dois dígitos para ordenar direito', () => {
    // Sem o zero à esquerda, 10 viria antes de 2 na pasta do usuário.
    expect(nomeNoPacote(0, video(MP4))).toBe('01.mp4')
    expect(nomeNoPacote(9, imagem(JPG))).toBe('10.jpg')
  })

  it('não repete o nome do anunciante, que já está no nome do ZIP', () => {
    expect(nomeNoPacote(0, video(MP4))).not.toContain('renan')
  })
})

describe('nomeDoPacote', () => {
  it('é o mesmo nome base, com extensão zip', () => {
    expect(nomeDoPacote(ad())).toBe('renan-botelho-dr-652131454176487.zip')
  })
})
