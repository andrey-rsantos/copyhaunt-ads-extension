/**
 * O content script roda em `document_start`, quando `document.body` ainda não
 * existe. Esperar por `DOMContentLoaded` para plantar a interface custa a
 * primeira tela inteira à toa — o body chega bem antes disso. Observamos
 * `documentElement`, que já existe em `document_start`, até o body nascer.
 */
export interface ControleArranque {
  parar(): void
}

export function iniciarQuandoHouverBody(
  doc: Document,
  iniciar: () => void,
): ControleArranque {
  let encerrado = false

  const parar = () => {
    encerrado = true
    observador.disconnect()
  }

  const observador = new MutationObserver(() => {
    if (encerrado || !doc.body) return
    parar()
    iniciar()
  })

  if (doc.body) {
    iniciar()
  } else {
    observador.observe(doc.documentElement, { childList: true })
  }

  return { parar }
}
