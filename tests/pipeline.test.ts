import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { processarCaptura } from '../src/content/pipeline'
import { AdStore } from '../src/core/store'

const PASTA = resolve(import.meta.dirname, 'fixtures')

function captura(arquivo: string) {
  return {
    url: 'https://www.facebook.com/api/graphql/',
    corpo: readFileSync(join(PASTA, arquivo), 'utf8'),
  }
}

describe('processarCaptura', () => {
  it('indexa os anúncios de uma resposta de busca real', () => {
    const store = new AdStore()
    const r = processarCaptura(captura('payload-01.json'), store)
    expect(r.tipo).toBe('busca')
    expect(r.novos).toBeGreaterThan(0)
    expect(store.total()).toBe(r.novos)
  })

  it('indexa uma busca que chega no segundo bloco de uma resposta deferred', () => {
    const store = new AdStore()
    const lote = readFileSync(join(PASTA, 'payload-01.json'), 'utf8')
    const corpo = [
      '{"data":{"page":null},"extensions":{"is_final":false}}',
      lote,
    ].join('\n')

    const r = processarCaptura(
      { url: 'https://www.facebook.com/api/graphql/', corpo },
      store,
    )

    expect(r.tipo).toBe('busca')
    expect(r.novos).toBeGreaterThan(0)
    expect(store.total()).toBe(r.novos)
  })

  it('acumula anúncios de dois lotes deferred distintos no mesmo corpo', () => {
    const primeiro = processarCaptura(
      captura('payload-01.json'),
      new AdStore(),
    )
    const segundo = processarCaptura(
      captura('payload-02.json'),
      new AdStore(),
    )
    const esperado = primeiro.novos + segundo.novos
    const corpo = [
      readFileSync(join(PASTA, 'payload-01.json'), 'utf8'),
      readFileSync(join(PASTA, 'payload-02.json'), 'utf8'),
    ].join('\n')
    const store = new AdStore()

    const r = processarCaptura(
      { url: 'https://www.facebook.com/api/graphql/', corpo },
      store,
    )

    expect(r.tipo).toBe('busca')
    expect(r.novos).toBe(esperado)
    expect(r.total).toBe(esperado)
    expect(store.total()).toBe(esperado)
  })

  it('soma ao longo de várias capturas', () => {
    const store = new AdStore()
    const a = processarCaptura(captura('payload-01.json'), store)
    const b = processarCaptura(captura('payload-02.json'), store)
    expect(b.total).toBe(a.novos + b.novos)
    expect(store.total()).toBe(b.total)
  })

  it('a mesma captura duas vezes não indexa de novo', () => {
    const store = new AdStore()
    processarCaptura(captura('payload-01.json'), store)
    const segunda = processarCaptura(captura('payload-01.json'), store)
    expect(segunda.novos).toBe(0)
  })

  it('ignora captura que não é de anúncios', () => {
    const store = new AdStore()
    const r = processarCaptura(
      { url: 'https://www.facebook.com/ajax/bz', corpo: '{"a":1}' },
      store,
    )
    expect(r.tipo).toBe('ignorar')
    expect(r.novos).toBe(0)
  })

  it('corpo inválido não derruba nada', () => {
    const store = new AdStore()
    const r = processarCaptura(
      { url: 'https://www.facebook.com/api/graphql/', corpo: 'não é json' },
      store,
    )
    expect(r.tipo).toBe('ignorar')
    expect(r.novos).toBe(0)
  })

  it('a presença do anunciante é contada ao indexar', () => {
    const store = new AdStore()
    processarCaptura(captura('payload-01.json'), store)
    const algum = store.todos()[0]
    expect(store.presenca(algum.anunciante.pageId)).toBeGreaterThan(0)
  })
})
