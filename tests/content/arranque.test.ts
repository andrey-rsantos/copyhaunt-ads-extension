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

  it('não inicia se parar() foi chamado antes de o body existir', async () => {
    const doc = document.implementation.createHTMLDocument('teste')
    const body = doc.body
    doc.documentElement.removeChild(body)
    const iniciar = vi.fn()

    const controle = iniciarQuandoHouverBody(doc, iniciar)
    controle.parar()

    // Testemunha independente no mesmo nó: prova que um turno de
    // MutationObserver completo já passou por `documentElement` antes da
    // asserção — se o observer do helper ainda estivesse ativo, já teria
    // disparado `iniciar` neste mesmo turno.
    const observado = new Promise<void>(resolve => {
      const testemunha = new MutationObserver(() => {
        testemunha.disconnect()
        resolve()
      })
      testemunha.observe(doc.documentElement, { childList: true })
    })

    doc.documentElement.appendChild(doc.createElement('body'))
    await observado

    expect(iniciar).not.toHaveBeenCalled()
  })
})
