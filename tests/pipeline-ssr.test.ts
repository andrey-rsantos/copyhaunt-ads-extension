// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { processarSsr } from '../src/content/pipeline'
import { AdStore } from '../src/core/store'

describe('processarSsr', () => {
  const FIXTURE_SSR = readFileSync(
    resolve(import.meta.dirname, 'fixtures', 'ssr-01.json'),
    'utf8',
  )

  function docComSsr(): Document {
    const doc = document.implementation.createHTMLDocument('teste')
    const script = doc.createElement('script')
    script.setAttribute('type', 'application/json')
    script.textContent = FIXTURE_SSR
    doc.body.appendChild(script)
    return doc
  }

  it('indexa o lote embutido no HTML', () => {
    const store = new AdStore()
    const r = processarSsr(docComSsr(), store)
    expect(r.novos).toBe(30)
    expect(r.total).toBe(30)
  })

  it('é idempotente: reler o mesmo HTML não duplica', () => {
    const store = new AdStore()
    const doc = docComSsr()
    processarSsr(doc, store)
    const segunda = processarSsr(doc, store)
    expect(segunda.novos).toBe(0)
    expect(segunda.total).toBe(30)
  })

  it('não estoura em documento sem lote embutido', () => {
    const store = new AdStore()
    const vazio = document.implementation.createHTMLDocument('vazio')
    const r = processarSsr(vazio, store)
    expect(r).toEqual({ novos: 0, total: 0 })
  })
})
