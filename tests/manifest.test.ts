import { describe, expect, it } from 'vitest'
import { manifest } from '../src/manifest.config'

/**
 * Tipo largo para inspeção. As duas entradas de content_scripts têm formatos
 * diferentes — só a do interceptador declara `world` — e o TypeScript infere
 * uma união onde o campo opcional não é acessível direto.
 */
type ScriptEntry = { js?: string[]; world?: string; run_at?: string }
const scripts = manifest.content_scripts as ScriptEntry[]

describe('manifest MV3', () => {
  it('declara ação para abrir resultados sem pedir permissões novas', () => {
    expect(manifest.action).toEqual({ default_title: 'Abrir resultados' })
    expect(manifest.permissions).toEqual(['storage'])
  })

  it('declara manifest_version 3', () => {
    expect(manifest.manifest_version).toBe(3)
  })

  it('pede exatamente a permissão storage', () => {
    expect(manifest.permissions).toEqual(['storage'])
  })

  it('pede exatamente os dois hosts necessários, e nada além', () => {
    expect(manifest.host_permissions).toEqual([
      '*://*.facebook.com/ads/library/*',
      'https://raw.githubusercontent.com/andrey-rsantos/copyhaunt-ads-extension/*',
    ])
  })

  it('não pede nenhuma permissão proibida pelo spec', () => {
    const proibidas = [
      'declarativeNetRequest',
      'tabs',
      'contextMenus',
      'downloads',
      'scripting',
    ]
    for (const p of proibidas) {
      expect(manifest.permissions).not.toContain(p)
    }
  })

  it('registra o interceptador no main world, em document_start', () => {
    const interceptor = scripts.find((s) =>
      s.js?.some((f) => f.includes('interceptor')),
    )
    expect(interceptor).toBeDefined()
    expect(interceptor?.world).toBe('MAIN')
    expect(interceptor?.run_at).toBe('document_start')
  })

  it('registra o content script no mundo isolado, em document_start', () => {
    const content = scripts.find((s) =>
      s.js?.some((f) => f.includes('content/')),
    )
    expect(content).toBeDefined()
    expect(content?.world).toBeUndefined()
    expect(content?.run_at).toBe('document_start')
  })

  it('usa service worker do tipo module', () => {
    expect(manifest.background?.type).toBe('module')
  })
})
