/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest'
import {
  focarPedidoAvaliacao,
  ID_AVALIACAO,
  LINK_AVALIACAO,
  montarPedidoAvaliacao,
} from '../../src/content/avaliacao'

describe('montarPedidoAvaliacao', () => {
  it('exibe o pedido e leva à página de avaliações da CWS', () => {
    const el = montarPedidoAvaliacao(document, { aoFechar: vi.fn() })

    expect(el.id).toBe(ID_AVALIACAO)
    expect(el.shadowRoot?.querySelector('[role="dialog"]')).not.toBeNull()
    expect(el.shadowRoot?.textContent).toContain('A CopyHaunt está caçando bem?')

    const link = el.shadowRoot?.querySelector<HTMLAnchorElement>(
      '[data-acao="avaliar"]',
    )
    expect(link?.textContent).toContain('Avaliar na Web Store')
    expect(link?.href).toBe(LINK_AVALIACAO)
    expect(link?.target).toBe('_blank')
    expect(link?.rel).toContain('noreferrer')
  })

  it('fecha em Agora não e informa que a desativação não foi escolhida', () => {
    const aoFechar = vi.fn()
    const el = montarPedidoAvaliacao(document, { aoFechar })
    document.body.appendChild(el)

    el.shadowRoot?.querySelector<HTMLElement>('[data-acao="agora-nao"]')?.click()

    expect(aoFechar).toHaveBeenCalledWith(false)
    expect(document.getElementById(ID_AVALIACAO)).toBeNull()
  })

  it('fecha com a escolha de não mostrar novamente', () => {
    const aoFechar = vi.fn()
    const el = montarPedidoAvaliacao(document, { aoFechar })
    document.body.appendChild(el)

    const checkbox = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-acao="nao-mostrar"]',
    )
    if (checkbox) checkbox.checked = true
    el.shadowRoot?.querySelector<HTMLElement>('[data-acao="fechar"]')?.click()

    expect(aoFechar).toHaveBeenCalledWith(true)
    expect(document.getElementById(ID_AVALIACAO)).toBeNull()
  })

  it('foca o diálogo, mantém Tab dentro dele e fecha com Escape', () => {
    const aoFechar = vi.fn()
    const el = montarPedidoAvaliacao(document, { aoFechar })
    document.body.appendChild(el)
    const dialog = el.shadowRoot?.querySelector<HTMLElement>('[role="dialog"]')
    const primeiro = el.shadowRoot?.querySelector<HTMLElement>('[data-acao="fechar"]')
    const ultimo = el.shadowRoot?.querySelector<HTMLInputElement>('[data-acao="nao-mostrar"]')

    focarPedidoAvaliacao(el)
    expect(el.shadowRoot?.activeElement).toBe(dialog)

    ultimo?.focus()
    ultimo?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(el.shadowRoot?.activeElement).toBe(primeiro)

    primeiro?.focus()
    primeiro?.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
    }))
    expect(el.shadowRoot?.activeElement).toBe(ultimo)

    dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(aoFechar).toHaveBeenCalledWith(false)
    expect(document.getElementById(ID_AVALIACAO)).toBeNull()
  })
})
