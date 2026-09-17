import { describe, expect, it } from 'vitest'
import {
  ehBuscarInstagramMensagem,
  origemBibliotecaValida,
} from '../src/core/instagram-ponte'

describe('ponte de Instagram', () => {
  it('aceita somente a Biblioteca HTTPS da Meta', () => {
    expect(origemBibliotecaValida(
      'https://www.facebook.com/ads/library/?q=receitas',
    )).toBe(true)
    expect(origemBibliotecaValida(
      'https://facebook.com/ads/library/?q=receitas',
    )).toBe(true)
    expect(origemBibliotecaValida('http://www.facebook.com/ads/library/')).toBe(false)
    expect(origemBibliotecaValida('https://evil.test/ads/library/')).toBe(false)
    expect(origemBibliotecaValida('https://www.facebook.com/profile.php')).toBe(false)
    expect(origemBibliotecaValida('https://www.facebook.com.evil.test/ads/library/')).toBe(false)
    expect(origemBibliotecaValida('não é url')).toBe(false)
  })

  it('rejeita pageId vazio e tipos desconhecidos', () => {
    expect(ehBuscarInstagramMensagem({
      tipo: 'buscar-instagram',
      pageId: '123',
      origem: 'https://www.facebook.com/ads/library/?q=x',
    })).toBe(true)
    expect(ehBuscarInstagramMensagem({
      tipo: 'buscar-instagram',
      pageId: '',
      origem: 'https://www.facebook.com/ads/library/?q=x',
    })).toBe(false)
    expect(ehBuscarInstagramMensagem({
      tipo: 'buscar-instagram',
      pageId: 123,
      origem: 'https://www.facebook.com/ads/library/?q=x',
    })).toBe(false)
    expect(ehBuscarInstagramMensagem({ tipo: 'outra' })).toBe(false)
    expect(ehBuscarInstagramMensagem(null)).toBe(false)
  })
})
