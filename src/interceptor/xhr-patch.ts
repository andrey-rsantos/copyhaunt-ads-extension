export interface Captura {
  url: string
  corpo: string
}

interface XhrAlvo {
  prototype: {
    open: (...args: unknown[]) => unknown
    send: (...args: unknown[]) => unknown
  }
}

/**
 * Diz se vale a pena olhar esta resposta.
 *
 * A página dispara XHR o tempo todo — só a telemetria em `/ajax/bz` já
 * responde por quatro de cada cinco requisições. Filtrar aqui, no main world,
 * evita que corpo de resposta inútil atravesse a fronteira entre os mundos.
 */
export function ehEndpointDeAnuncios(url: string): boolean {
  return url.includes('/api/graphql/') || url.includes('/search_ads/')
}

/**
 * Remove `excluded_ids` da query. A Meta usa esse parâmetro para não repetir
 * anúncios já entregues; sem ele a resposta volta completa.
 */
export function removerExcludedIds(url: string): string {
  const [base, query] = url.split('?')
  if (!query) return url

  const original = new URLSearchParams(query)
  const limpa = new URLSearchParams()
  for (const [chave, valor] of original.entries()) {
    if (chave.toLowerCase().includes('excluded_ids')) continue
    limpa.append(chave, valor)
  }
  const resultado = limpa.toString()
  return resultado ? `${base}?${resultado}` : base
}

/**
 * Aplica o patch em XMLHttpRequest e avisa a cada resposta concluída.
 *
 * O alvo vem por parâmetro em vez de `window.XMLHttpRequest` direto para que
 * o patch possa ser testado com um objeto falso, sem navegador.
 *
 * Depois de aplicado, `open` e `send` viram não graváveis: se a página tentar
 * restaurar os originais, o patch sobrevive.
 */
export function aplicarPatch(
  alvo: XhrAlvo,
  aoCapturar: (captura: Captura) => void,
): void {
  const openOriginal = alvo.prototype.open
  Object.defineProperty(alvo.prototype, 'open', { writable: true })
  alvo.prototype.open = function (this: unknown, ...args: unknown[]) {
    const url = args[1]
    if (typeof url === 'string' && url.includes('/search_ads/')) {
      args[1] = removerExcludedIds(url)
    }
    return openOriginal.apply(this, args)
  }
  Object.defineProperty(alvo.prototype, 'open', { writable: false })

  const sendOriginal = alvo.prototype.send
  Object.defineProperty(alvo.prototype, 'send', { writable: true })
  alvo.prototype.send = function (this: XMLHttpRequest, ...args: unknown[]) {
    this.addEventListener('load', function (this: XMLHttpRequest) {
      // Um consumidor que explode não pode derrubar a requisição da página.
      try {
        const tipo = this.responseType
        if (tipo && tipo !== 'text') return
        aoCapturar({ url: this.responseURL, corpo: this.responseText })
      } catch {
        // silêncio proposital: a página não pode perceber que estamos aqui
      }
    })
    return sendOriginal.apply(this, args)
  }
  Object.defineProperty(alvo.prototype, 'send', { writable: false })
}
