/**
 * Estilo da bandeja, com as cores normativas de `CopyHaunt-IDV.md`.
 *
 * Vive dentro de shadow root: o CSS da Meta não alcança o nosso, e o nosso
 * não alcança o deles. Nenhuma regra aqui pode usar `border` no card — isso
 * ocuparia espaço e empurraria todos os cards da grade.
 */
export const CSS_BANDEJA = `
  :host { all: initial; }

  .bandeja {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    gap: 6px;
    z-index: 9;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  }

  .botao {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    background: #7C3AED;
    color: #FFFFFF;
    cursor: pointer;
    box-shadow: 0 0 20px rgba(124, 58, 237, 0.18);
    transition: filter 150ms ease;
    user-select: none;
    font-size: 13px;
    line-height: 1;
  }
  .botao:hover { filter: brightness(1.15); }

  .badge {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 9;
    padding: 4px 9px;
    border-radius: 9px;
    background: #08070D;
    color: #FFFFFF;
    font-family: Sora, Inter, ui-sans-serif, system-ui, sans-serif;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .badge[data-faixa="novo"] { color: #C4A7FF; }
  .badge[data-faixa="provado"] { color: #7C3AED; }
  .badge[data-faixa="validado"] {
    color: #A855F7;
    box-shadow: 0 0 20px rgba(168, 85, 247, 0.25);
  }
`

let folha: CSSStyleSheet | null = null

/**
 * Uma folha construída para todos os shadow roots.
 *
 * Construída uma vez e adotada por todos: com 25 cards na tela, duplicar o
 * CSS 25 vezes seria desperdício puro.
 */
export function folhaCompartilhada(): CSSStyleSheet | null {
  if (typeof CSSStyleSheet === 'undefined') return null
  if (folha) return folha
  try {
    folha = new CSSStyleSheet()
    folha.replaceSync(CSS_BANDEJA)
    return folha
  } catch {
    return null // navegador sem folha construída: cai para <style>
  }
}

/** Cria (ou reaproveita) o shadow root do host, já com o estilo dentro. */
export function criarShadow(host: HTMLElement): ShadowRoot {
  if (host.shadowRoot) return host.shadowRoot

  const shadow = host.attachShadow({ mode: 'open' })
  const compartilhada = folhaCompartilhada()

  if (compartilhada && 'adoptedStyleSheets' in shadow) {
    shadow.adoptedStyleSheets = [compartilhada]
  } else {
    const style = document.createElement('style')
    style.textContent = CSS_BANDEJA
    shadow.appendChild(style)
  }

  return shadow
}
