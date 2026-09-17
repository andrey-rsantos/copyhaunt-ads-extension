/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest'
import { iniciarQuandoHouverBody } from '../../src/content/arranque'

describe('iniciarQuandoHouverBody', () => {
  it('inicia imediatamente quando o body já existe', () => {
    const iniciar = vi.fn()

    const controle = iniciarQuandoHouverBody(document, iniciar)

    expect(iniciar).toHaveBeenCalledOnce()
    controle.parar()
  })

  it('inicia quando o body surge sem esperar DOMContentLoaded', async () => {
    const doc = document.implementation.createHTMLDocument('teste')
    const body = doc.body
    doc.documentElement.removeChild(body)
    const iniciar = vi.fn()

    const controle = iniciarQuandoHouverBody(doc, iniciar)
    const novoBody = doc.createElement('body')
    doc.documentElement.appendChild(novoBody)

    await vi.waitFor(() => expect(iniciar).toHaveBeenCalledOnce())

    controle.parar()
  })

  it('não inicia duas vezes e permite encerrar a observação', async () => {
    const doc = document.implementation.createHTMLDocument('teste')
    const body = doc.body
    doc.documentElement.removeChild(body)
    const iniciar = vi.fn()
    const controle = iniciarQuandoHouverBody(doc, iniciar)

    doc.documentElement.appendChild(doc.createElement('body'))
    await vi.waitFor(() => expect(iniciar).toHaveBeenCalledOnce())
    doc.documentElement.appendChild(doc.createElement('body'))

    await Promise.resolve()
    expect(iniciar).toHaveBeenCalledOnce()
    controle.parar()
  })
})
