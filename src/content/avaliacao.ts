import { LINK_AVALIACAO } from '../core/avaliacao'

export const ID_AVALIACAO = 'copyhaunt-avaliacao'
export { LINK_AVALIACAO }

export interface OpcoesPedidoAvaliacao {
  aoFechar: (naoMostrarNovamente: boolean) => void
}

export function focarPedidoAvaliacao(host: HTMLElement): void {
  host.shadowRoot?.querySelector<HTMLElement>('[role="dialog"]')?.focus()
}

const CSS = `
  :host {
    all: initial;
    position: fixed;
    z-index: 2147483647;
    inset: 0;
    display: block;
    color: #FFFFFF;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; }

  button, a, input { font: inherit; }

  .fundo {
    display: grid;
    width: 100%;
    height: 100%;
    padding: 24px;
    place-items: center;
    background: rgba(8, 7, 13, 0.72);
    backdrop-filter: blur(5px);
  }

  .modal {
    position: relative;
    width: min(100%, 430px);
    padding: 32px;
    border: 1px solid rgba(168, 85, 247, 0.52);
    border-radius: 16px;
    background:
      radial-gradient(circle at 50% -15%, rgba(168, 85, 247, 0.18), transparent 13rem),
      #111019;
    box-shadow:
      0 0 0 1px rgba(59, 29, 115, 0.42),
      0 24px 80px rgba(0, 0, 0, 0.58),
      0 0 32px rgba(124, 58, 237, 0.18);
    text-align: center;
  }

  .fechar {
    position: absolute;
    top: 12px;
    right: 12px;
    display: grid;
    width: 30px;
    height: 30px;
    place-items: center;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #8B8698;
    cursor: pointer;
    font-size: 20px;
  }

  .fechar:hover { background: rgba(255, 255, 255, 0.06); color: #FFFFFF; }

  .icone {
    display: grid;
    width: 68px;
    height: 68px;
    margin: 0 auto 22px;
    place-items: center;
    border: 1px solid rgba(196, 167, 255, 0.55);
    border-radius: 20px;
    background: linear-gradient(145deg, #3B1D73, #7C3AED);
    box-shadow: 0 0 28px rgba(168, 85, 247, 0.24);
    color: #FFFFFF;
  }

  .icone svg { width: 44px; height: 44px; }

  .eyebrow {
    margin: 0 0 13px;
    color: #C4A7FF;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0 0 12px;
    font-family: Sora, ui-sans-serif, system-ui, sans-serif;
    font-size: clamp(23px, 5vw, 29px);
    letter-spacing: -0.05em;
    line-height: 1.06;
  }

  h2 span { color: #C4A7FF; }

  .mensagem {
    margin: 0 auto 22px;
    color: #B8B5C6;
    font-size: 13px;
    line-height: 1.6;
  }

  .estrelas {
    display: inline-flex;
    gap: 5px;
    margin-bottom: 22px;
    color: #C4A7FF;
    font-size: 19px;
    letter-spacing: 0.04em;
  }

  .acoes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .acoes a, .acoes button {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    transition: transform 160ms ease, box-shadow 160ms ease;
  }

  .primaria {
    border: 1px solid #A855F7;
    background: linear-gradient(110deg, #7C3AED, #A855F7);
    color: #FFFFFF;
  }

  .secundaria {
    border: 1px solid #302B3D;
    background: #181621;
    color: #FFFFFF;
  }

  .acoes a:hover, .acoes button:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(124, 58, 237, 0.2);
  }

  .nao-mostrar {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 20px;
    color: #8E899B;
    cursor: pointer;
    font-size: 11px;
  }

  .nao-mostrar input { width: 14px; height: 14px; accent-color: #7C3AED; }

  .rodape { margin: 20px 0 0; color: #716C7D; font-size: 10px; }

  :focus-visible { outline: 2px solid #A855F7; outline-offset: 2px; }

  @media (max-width: 520px) {
    .modal { padding: 28px 22px; }
    .acoes { grid-template-columns: 1fr; }
  }
`

function montarFantasma(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 48 48')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2.4')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')

  const corpo = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
  corpo.setAttribute('d', 'M10 36V20a14 14 0 0 1 28 0v16l-5-4-5 4-5-4-5 4-5-4-3 4Z')
  svg.appendChild(corpo)

  for (const x of [19, 29]) {
    const olho = doc.createElementNS('http://www.w3.org/2000/svg', 'circle')
    olho.setAttribute('cx', String(x))
    olho.setAttribute('cy', '22')
    olho.setAttribute('r', '1')
    olho.setAttribute('fill', 'currentColor')
    svg.appendChild(olho)
  }

  return svg
}

export function montarPedidoAvaliacao(
  doc: Document,
  opcoes: OpcoesPedidoAvaliacao,
): HTMLElement {
  const host = doc.createElement('div')
  host.id = ID_AVALIACAO
  const shadow = host.attachShadow({ mode: 'open' })

  const estilo = doc.createElement('style')
  estilo.textContent = CSS
  shadow.appendChild(estilo)

  const fundo = doc.createElement('div')
  fundo.className = 'fundo'
  const modal = doc.createElement('article')
  modal.className = 'modal'
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.setAttribute('aria-labelledby', 'copyhaunt-avaliacao-titulo')
  modal.tabIndex = -1

  const fechar = doc.createElement('button')
  fechar.className = 'fechar'
  fechar.dataset.acao = 'fechar'
  fechar.type = 'button'
  fechar.setAttribute('aria-label', 'Fechar')
  fechar.textContent = '×'

  const icone = doc.createElement('div')
  icone.className = 'icone'
  icone.setAttribute('aria-hidden', 'true')
  icone.appendChild(montarFantasma(doc))

  const eyebrow = doc.createElement('p')
  eyebrow.className = 'eyebrow'
  eyebrow.textContent = 'Um pequeno pedido do fantasma'

  const titulo = doc.createElement('h2')
  titulo.id = 'copyhaunt-avaliacao-titulo'
  titulo.append('A CopyHaunt está ')
  const destaque = doc.createElement('span')
  destaque.textContent = 'caçando bem?'
  titulo.appendChild(destaque)

  const mensagem = doc.createElement('p')
  mensagem.className = 'mensagem'
  mensagem.textContent =
    'Se a extensão está ajudando você a encontrar boas referências, deixe uma avaliação na Chrome Web Store. Isso ajuda outras pessoas a descobrir a CopyHaunt.'

  const estrelas = doc.createElement('div')
  estrelas.className = 'estrelas'
  estrelas.setAttribute('aria-label', 'Cinco estrelas')
  estrelas.textContent = '★ ★ ★ ★ ★'

  const acoes = doc.createElement('div')
  acoes.className = 'acoes'
  const avaliar = doc.createElement('a')
  avaliar.className = 'primaria'
  avaliar.dataset.acao = 'avaliar'
  avaliar.href = LINK_AVALIACAO
  avaliar.target = '_blank'
  avaliar.rel = 'noopener noreferrer'
  avaliar.textContent = 'Avaliar na Web Store ↗'

  const agoraNao = doc.createElement('button')
  agoraNao.className = 'secundaria'
  agoraNao.dataset.acao = 'agora-nao'
  agoraNao.type = 'button'
  agoraNao.textContent = 'Agora não'
  acoes.append(avaliar, agoraNao)

  const label = doc.createElement('label')
  label.className = 'nao-mostrar'
  const checkbox = doc.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.dataset.acao = 'nao-mostrar'
  const textoCheckbox = doc.createElement('span')
  textoCheckbox.textContent = 'Não mostrar isso novamente'
  label.append(checkbox, textoCheckbox)

  const rodape = doc.createElement('p')
  rodape.className = 'rodape'
  rodape.textContent = 'Você verá este lembrete novamente em 5 dias.'

  modal.append(fechar, icone, eyebrow, titulo, mensagem, estrelas, acoes, label, rodape)
  fundo.appendChild(modal)
  shadow.appendChild(fundo)

  let encerrado = false
  const focaveis = (): HTMLElement[] =>
    [...modal.querySelectorAll<HTMLElement>('button, a[href], input:not([disabled])')]

  const fecharPedido = (): void => {
    if (encerrado) return
    encerrado = true
    opcoes.aoFechar(checkbox.checked)
    host.remove()
  }

  modal.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      evento.preventDefault()
      fecharPedido()
      return
    }
    if (evento.key !== 'Tab') return

    const elementos = focaveis()
    if (elementos.length === 0) return
    const atual = shadow.activeElement as HTMLElement | null
    const indice = atual ? elementos.indexOf(atual) : -1
    const proximo = evento.shiftKey
      ? indice <= 0 ? elementos[elementos.length - 1] : elementos[indice - 1]
      : indice === elementos.length - 1 ? elementos[0] : elementos[indice + 1]
    evento.preventDefault()
    proximo.focus()
  })

  fechar.addEventListener('click', fecharPedido)
  agoraNao.addEventListener('click', fecharPedido)
  avaliar.addEventListener('click', fecharPedido)

  return host
}
