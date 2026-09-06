import { describe, expect, it } from 'vitest'
import {
  NAMESPACE,
  createMessage,
  isCopyHauntMessage,
} from '../src/core/messages'

describe('contrato de mensagens', () => {
  it('usa um namespace próprio', () => {
    expect(NAMESPACE).toBe('copyhaunt')
  })

  it('cria mensagem carimbada com o namespace', () => {
    const msg = createMessage('interceptor-ready', {})
    expect(msg.namespace).toBe(NAMESPACE)
    expect(msg.kind).toBe('interceptor-ready')
  })

  it('reconhece a própria mensagem', () => {
    const msg = createMessage('panel-ready', {})
    expect(isCopyHauntMessage(msg)).toBe(true)
  })

  it('rejeita mensagem de terceiros com outro namespace', () => {
    const intruso = { namespace: 'outra-extensao', kind: 'panel-ready' }
    expect(isCopyHauntMessage(intruso)).toBe(false)
  })

  it('rejeita valores que não são objeto', () => {
    expect(isCopyHauntMessage(null)).toBe(false)
    expect(isCopyHauntMessage('texto')).toBe(false)
    expect(isCopyHauntMessage(42)).toBe(false)
    expect(isCopyHauntMessage(undefined)).toBe(false)
  })

  it('preserva o payload', () => {
    const msg = createMessage('raw-capture', {
      url: 'https://www.facebook.com/api/graphql/',
      body: '{}',
    })
    expect(msg.payload).toEqual({
      url: 'https://www.facebook.com/api/graphql/',
      body: '{}',
    })
  })
})
