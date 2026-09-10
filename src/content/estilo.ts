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
  .botao[data-ocupado] {
    opacity: 0.55;
    cursor: progress;
  }

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

  .menu {
    position: absolute;
    top: 44px;
    left: 8px;
    z-index: 10;
    min-width: 210px;
    padding: 6px;
    border-radius: 12px;
    background: #08070D;
    box-shadow: 0 0 20px rgba(124, 58, 237, 0.25);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    font-size: 13px;
  }

  .menu .item {
    padding: 8px 10px;
    border-radius: 8px;
    color: #FFFFFF;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .menu .item:hover { background: #7C3AED; }

  .menu .item[data-estado="buscando"] {
    color: #C4A7FF;
    opacity: 0.7;
    cursor: progress;
  }
  .menu .item[data-estado="buscando"]:hover { background: transparent; }
  .menu .item[data-estado="achou"] { color: #A855F7; font-weight: 600; }

  .menu .item[data-desabilitado="sim"] {
    color: #C4A7FF;
    opacity: 0.45;
    cursor: not-allowed;
  }
  .menu .item[data-desabilitado="sim"]:hover { background: transparent; }
`

/**
 * Estilo dos enxertos na barra da Meta.
 *
 * Cores de `CopyHaunt-IDV.md`. A altura de 36 px é a dos controles da Meta,
 * medida em 2026-09-10 — nada aqui pode mudar a altura da fila, ou a barra
 * inteira se desloca.
 */
export const CSS_ENXERTOS = `
  /* Escopado ao host dos enxertos de propósito. Esta folha é compartilhada
     com as bandejas dos cards, cujo host é um div sem estilo próprio que
     conta com o \`all: initial\` de CSS_BANDEJA para não ocupar espaço. Um
     \`:host\` solto aqui venceria aquele por vir depois, daria \`display:flex\`
     ao host da bandeja e empurraria o conteúdo de todo card para baixo. */
  :host(#copyhaunt-enxertos) { all: initial; display: flex; align-items: center; }

  .fila {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 8px;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  }

  /* O divisor separa o nosso do da Meta: dois enxertos avulsos viram um
     produto quando têm uma fronteira visível (spec, 7.1). */
  .divisor {
    width: 1px;
    height: 24px;
    background: rgba(124, 58, 237, 0.28);
    margin-right: 2px;
  }

  .botao {
    height: 36px;
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 10px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 600;
    transition: filter 150ms ease;
  }
  .botao:hover { filter: brightness(1.12); }

  .botao[data-variante="solido"] {
    background: #7C3AED;
    color: #FFFFFF;
    box-shadow: 0 0 20px rgba(124, 58, 237, 0.18);
  }
  .botao[data-variante="contorno"] {
    background: transparent;
    color: #7C3AED;
    box-shadow: inset 0 0 0 1.5px #7C3AED;
  }
  .botao[data-aberto] { filter: brightness(1.2); }
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
    folha.replaceSync(CSS_BANDEJA + CSS_ENXERTOS)
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
    style.textContent = CSS_BANDEJA + CSS_ENXERTOS
    shadow.appendChild(style)
  }

  return shadow
}
