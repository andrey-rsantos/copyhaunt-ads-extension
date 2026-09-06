// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extrairPayloadsSsr } from '../src/content/ssr'
import { normalizarBusca } from '../src/core/normalize'

const FIXTURE = readFileSync(
  resolve(import.meta.dirname, 'fixtures', 'ssr-01.json'),
  'utf8',
)

/** Monta um documento com um script do tipo que a Meta serve. */
function comScript(conteudo: string, tipo = 'application/json'): Document {
  const doc = document.implementation.createHTMLDocument('teste')
  const script = doc.createElement('script')
  script.setAttribute('type', tipo)
  script.setAttribute('data-sjs', '')
  script.textContent = conteudo
  doc.body.appendChild(script)
  return doc
}

describe('extrairPayloadsSsr', () => {
  it('acha o payload dentro do envelope real da Meta', () => {
    const achados = extrairPayloadsSsr(comScript(FIXTURE))
    expect(achados).toHaveLength(1)
  })

  it('o payload achado tem a forma que o normalizador espera', () => {
    const [payload] = extrairPayloadsSsr(comScript(FIXTURE))
    const ads = normalizarBusca(payload)
    expect(ads).toHaveLength(30)
  })

  it('os anúncios saem completos, não só o id', () => {
    const [payload] = extrairPayloadsSsr(comScript(FIXTURE))
    const ads = normalizarBusca(payload)
    const anunciantes = new Set(ads.map((a) => a.anunciante.pageId))
    expect(anunciantes.size).toBe(17)
    for (const ad of ads) {
      expect(ad.id).toMatch(/^\d{15,17}$/)
      expect(ad.iniciouEm.getTime()).toBeGreaterThan(0)
      expect(ad.anunciante.pageName.length).toBeGreaterThan(0)
    }
  })

  it('ignora script que não carrega busca, sem parsear', () => {
    const doc = comScript('{"require":[["Bootloader",[],[],[]]]}')
    expect(extrairPayloadsSsr(doc)).toHaveLength(0)
  })

  it('sobrevive a JSON malformado', () => {
    const doc = comScript('{"search_results_connection": ')
    expect(() => extrairPayloadsSsr(doc)).not.toThrow()
    expect(extrairPayloadsSsr(doc)).toHaveLength(0)
  })

  it('não olha script de outro tipo', () => {
    const doc = comScript(FIXTURE, 'text/javascript')
    expect(extrairPayloadsSsr(doc)).toHaveLength(0)
  })

  it('devolve vazio num documento sem script nenhum', () => {
    const doc = document.implementation.createHTMLDocument('vazio')
    expect(extrairPayloadsSsr(doc)).toHaveLength(0)
  })
})
