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
  :host(#copyhaunt-enxertos) {
    all: initial;
    display: flex;
    align-items: center;
    position: relative;
  }

  :host(#copyhaunt-enxertos) .fila {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 8px;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  }

  /* O divisor separa o nosso do da Meta: dois enxertos avulsos viram um
     produto quando têm uma fronteira visível (spec, 7.1). */
  :host(#copyhaunt-enxertos) .divisor {
    width: 1px;
    height: 24px;
    background: rgba(124, 58, 237, 0.28);
    margin-right: 2px;
  }

  :host(#copyhaunt-enxertos) .botao {
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
  :host(#copyhaunt-enxertos) .botao[data-icone-apenas] {
    width: 36px;
    padding: 0;
    justify-content: center;
  }
  :host(#copyhaunt-enxertos) .botao:hover { filter: brightness(1.12); }

  :host(#copyhaunt-enxertos) .botao[data-variante="solido"] {
    background: #7C3AED;
    color: #FFFFFF;
    box-shadow: 0 0 20px rgba(124, 58, 237, 0.18);
  }
  :host(#copyhaunt-enxertos) .botao[data-variante="contorno"] {
    background: transparent;
    color: #7C3AED;
    box-shadow: inset 0 0 0 1.5px #7C3AED;
  }
  :host(#copyhaunt-enxertos) .botao[data-aberto] { filter: brightness(1.2); }
`

/**
 * A gaveta que se abre sob os enxertos. Uma por vez (spec, 7.1).
 *
 * Como em CSS_ENXERTOS, todo seletor é escopado ao host dos enxertos: a folha
 * é compartilhada com as bandejas dos cards, e classe de mesmo nome nas duas
 * folhas faz a de baixo vencer dentro do shadow da outra.
 */
export const CSS_GAVETA = `
  :host(#copyhaunt-enxertos) .gaveta {
    position: absolute;
    top: 44px;
    right: 0;
    min-width: 300px;
    padding: 16px;
    border-radius: 14px;
    background: #08070D;
    color: #FFFFFF;
    box-shadow: 0 0 20px rgba(124, 58, 237, 0.25);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    z-index: 2147483647;
  }

  :host(#copyhaunt-enxertos) .gaveta h3 {
    margin: 0 0 10px;
    font-family: Sora, Inter, ui-sans-serif, system-ui, sans-serif;
    font-size: 14px;
    font-weight: 600;
  }

  :host(#copyhaunt-enxertos) .gaveta .linha {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
  }

  :host(#copyhaunt-enxertos) .gaveta button,
  :host(#copyhaunt-enxertos) .gaveta input {
    font: inherit;
  }

  :host(#copyhaunt-enxertos) .gaveta .campo {
    width: 80px;
    padding: 6px 8px;
    border: 1px solid #302B3D;
    border-radius: 8px;
    background: #1A1622;
    color: #FFFFFF;
  }
  :host(#copyhaunt-enxertos) .gaveta .campo:focus-visible {
    outline: 2px solid #A855F7;
    outline-offset: 1px;
  }

  :host(#copyhaunt-enxertos) .gaveta .preset {
    min-height: 32px;
    padding: 0 10px;
    border: 1px solid rgba(196, 167, 255, 0.4);
    border-radius: 8px;
    background: transparent;
    color: #FFFFFF;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
  }
  :host(#copyhaunt-enxertos) .gaveta .preset:hover,
  :host(#copyhaunt-enxertos) .gaveta .preset[data-selecionado="true"] {
    border-color: #7C3AED;
    box-shadow: inset 0 0 0 1px #7C3AED;
    color: #C4A7FF;
  }
  :host(#copyhaunt-enxertos) .gaveta .preset:focus-visible,
  :host(#copyhaunt-enxertos) .gaveta .acao:focus-visible {
    outline: 2px solid #A855F7;
    outline-offset: 2px;
  }

  :host(#copyhaunt-enxertos) .gaveta .nota {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    color: #C4A7FF;
    font-size: 12px;
  }

  :host(#copyhaunt-enxertos) .gaveta .acao {
    width: 100%;
    margin-top: 12px;
    height: 38px;
    border: 0;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
  }
  :host(#copyhaunt-enxertos) .gaveta .acao--primaria {
    background: #7C3AED;
    color: #FFFFFF;
    box-shadow: 0 0 16px rgba(124, 58, 237, 0.2);
  }
  :host(#copyhaunt-enxertos) .gaveta .acao:hover { filter: brightness(1.12); }
`

/** O cartão de progresso, que ocupa o lugar do botão durante a varredura. */
export const CSS_PROGRESSO = `
  :host(#copyhaunt-enxertos) .progresso {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 36px;
    padding: 0 14px;
    border-radius: 10px;
    background: #08070D;
    color: #FFFFFF;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    font-size: 12px;
    white-space: nowrap;
  }

  :host(#copyhaunt-enxertos) .progresso .trilho {
    width: 90px;
    height: 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.14);
    overflow: hidden;
  }
  :host(#copyhaunt-enxertos) .progresso .barra {
    height: 100%;
    width: 0%;
    background: #7C3AED;
    transition: width 300ms ease;
  }

  :host(#copyhaunt-enxertos) .progresso .numero { font-weight: 600; color: #C4A7FF; }

  :host(#copyhaunt-enxertos) .progresso button {
    min-height: 28px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: filter 150ms ease, background 150ms ease, box-shadow 150ms ease;
  }
  :host(#copyhaunt-enxertos) .progresso button:hover { filter: brightness(1.14); }
  :host(#copyhaunt-enxertos) .progresso button:focus-visible {
    outline: 2px solid #A855F7;
    outline-offset: 2px;
  }
  :host(#copyhaunt-enxertos) .progresso button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :host(#copyhaunt-enxertos) .progresso [data-acao="resultados"] {
    background: #7C3AED;
    color: #FFFFFF;
    box-shadow: 0 0 16px rgba(124, 58, 237, 0.2);
  }
  :host(#copyhaunt-enxertos) .progresso [data-acao="repetir"],
  :host(#copyhaunt-enxertos) .progresso [data-acao="parar"] {
    background: #181621;
    color: #FFFFFF;
    box-shadow: inset 0 0 0 1px #302B3D;
  }

  :host(#copyhaunt-enxertos) .progresso .pausar {
    border: 0;
    background: transparent;
    color: #C4A7FF;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  :host(#copyhaunt-enxertos) .progresso [data-acao="recolher"] {
    width: 28px;
    padding: 0;
    background: transparent;
    color: #C4A7FF;
  }
`

/**
 * Uma folha construída por tipo de host, adotada por todos os shadows dele.
 *
 * Construída uma vez: com 25 cards na tela, duplicar o CSS 25 vezes seria
 * desperdício. E uma por tipo, não uma só: a folha única colidiu três vezes
 * pela classe `.botao` — a última deu aos enxertos o `width: 30px` da
 * bandeja, e "Tempo ativo" não cabe em 30 px. Bandeja e enxertos nunca
 * moram no mesmo shadow, então não há motivo para um ver o CSS do outro.
 */
const FOLHAS = {
  bandeja: CSS_BANDEJA,
  enxertos: CSS_ENXERTOS + CSS_GAVETA + CSS_PROGRESSO,
} as const

type TipoDeHost = keyof typeof FOLHAS

const construidas: Partial<Record<TipoDeHost, CSSStyleSheet | null>> = {}

function folhaConstruida(tipo: TipoDeHost): CSSStyleSheet | null {
  if (typeof CSSStyleSheet === 'undefined') return null
  if (tipo in construidas) return construidas[tipo] ?? null
  try {
    const folha = new CSSStyleSheet()
    folha.replaceSync(FOLHAS[tipo])
    construidas[tipo] = folha
  } catch {
    construidas[tipo] = null // navegador sem folha construída: cai para <style>
  }
  return construidas[tipo] ?? null
}

/** Cria (ou reaproveita) o shadow root do host, já com o estilo dele dentro. */
export function criarShadow(host: HTMLElement): ShadowRoot {
  if (host.shadowRoot) return host.shadowRoot

  const tipo: TipoDeHost =
    host.id === 'copyhaunt-enxertos' ? 'enxertos' : 'bandeja'
  const shadow = host.attachShadow({ mode: 'open' })
  const construida = folhaConstruida(tipo)

  if (construida && 'adoptedStyleSheets' in shadow) {
    shadow.adoptedStyleSheets = [construida]
  } else {
    const style = document.createElement('style')
    style.textContent = FOLHAS[tipo]
    shadow.appendChild(style)
  }

  return shadow
}
