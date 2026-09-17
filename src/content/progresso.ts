import type { EstadoMineracao, Progresso } from '../core/miner'

/**
 * O cartão que substitui o botão Minerar durante a varredura (spec, 7.9).
 *
 * **A interface não fala de risco** (spec, 6.2). O motor distingue
 * `limite-seguranca` de `incompreensivel`, e essa distinção é nossa, para o
 * console e para o log: ao usuário, os dois são o mesmo fim de mineração.
 * Dizer "limite de segurança" convida a perguntar de que segurança se trata.
 */

const ROTULOS: Record<EstadoMineracao, string> = {
  parado: 'Pronto',
  minerando: 'Minerando',
  pausado: 'Pausado',
  interrompida: 'Mineração interrompida',
  concluido: 'Concluído',
  esgotado: 'Fim dos resultados',
  incompreensivel: 'Mineração encerrada',
  'limite-seguranca': 'Mineração encerrada',
}

/** Estados em que não há mais o que pausar nem retomar. */
const TERMINAIS: ReadonlySet<EstadoMineracao> = new Set([
  'interrompida',
  'concluido',
  'esgotado',
  'incompreensivel',
  'limite-seguranca',
])

export function rotuloDoEstado(estado: EstadoMineracao): string {
  return ROTULOS[estado]
}

export interface AcoesProgresso {
  aoAlternarPausa: () => void
  aoAbrirResultados: () => void
  aoParar: () => void
  aoMinerarNovamente: () => void
}

export function montarProgresso(doc: Document, acoes: AcoesProgresso): HTMLElement {
  const cartao = doc.createElement('div')
  cartao.className = 'progresso'

  const estado = doc.createElement('span')
  estado.dataset.papel = 'estado'
  estado.textContent = ROTULOS.parado

  const trilho = doc.createElement('div')
  trilho.className = 'trilho'
  const barra = doc.createElement('div')
  barra.className = 'barra'
  barra.dataset.papel = 'barra'
  trilho.appendChild(barra)

  const pausar = botao(doc, 'pausar', 'Pausar', acoes.aoAlternarPausa)
  pausar.hidden = false

  // Só ganha vida quando o snapshot parcial ou final estiver gravado.
  const resultados = botao(doc, 'resultados', 'Ver resultados', acoes.aoAbrirResultados)
  resultados.disabled = true

  cartao.append(
    estado,
    trilho,
    contador(doc, 'encontrados', 'encontrados'),
    contador(doc, 'analisados', 'analisados'),
    contador(doc, 'rolagens', 'rolagens'),
    pausar,
    botao(doc, 'parar', 'Parar mineração', acoes.aoParar),
    resultados,
    botao(doc, 'repetir', 'Minerar novamente', acoes.aoMinerarNovamente),
  )

  return cartao
}

/** Um botão do cartão; nasce escondido, `atualizarProgresso` decide quem aparece. */
function botao(
  doc: Document,
  acao: string,
  texto: string,
  aoClicar: () => void,
): HTMLButtonElement {
  const el = doc.createElement('button')
  el.className = acao
  el.dataset.acao = acao
  el.textContent = texto
  el.hidden = true
  el.addEventListener('click', (ev) => {
    ev.stopPropagation()
    aoClicar()
  })
  return el
}

/** Habilita o atalho; a visibilidade continua sendo decidida pelo estado. */
export function liberarResultados(cartao: HTMLElement): void {
  const botao = cartao.querySelector<HTMLButtonElement>('[data-acao="resultados"]')
  if (!botao) return
  botao.hidden = false
  botao.disabled = false
}

export function atualizarProgresso(
  cartao: HTMLElement,
  p: Progresso,
  alvo: number,
): void {
  const põe = (papel: string, texto: string): void => {
    const el = cartao.querySelector(`[data-papel="${papel}"]`)
    if (el) el.textContent = texto
  }

  põe('estado', ROTULOS[p.estado])
  põe('analisados', String(p.analisados))
  põe('encontrados', String(p.encontrados))
  põe('rolagens', String(p.rolagens))

  const barra = cartao.querySelector<HTMLElement>('[data-papel="barra"]')
  if (barra) {
    // Contra o alvo, não contra os analisados: o usuário pediu N aprovados, e
    // é isso que ele espera ver encher. O lote que cruza o alvo pode passar
    // dele por um instante — `miner.ts` corta depois.
    const pct = alvo > 0 ? Math.min(100, (p.encontrados / alvo) * 100) : 0
    barra.style.width = `${Math.round(pct)}%`
  }

  const terminou = TERMINAIS.has(p.estado)
  const mostrar = (acao: string, visivel: boolean): HTMLButtonElement | null => {
    const el = cartao.querySelector<HTMLButtonElement>(`[data-acao="${acao}"]`)
    if (el) el.hidden = !visivel
    return el
  }

  const pausar = mostrar('pausar', !terminou)
  if (pausar) pausar.textContent = p.estado === 'pausado' ? 'Retomar' : 'Pausar'
  mostrar('parar', p.estado === 'pausado')
  mostrar('resultados', p.estado === 'pausado' || terminou)
  mostrar('repetir', terminou)
}

function contador(doc: Document, papel: string, rotulo: string): HTMLElement {
  const wrap = doc.createElement('span')

  const numero = doc.createElement('span')
  numero.className = 'numero'
  numero.dataset.papel = papel
  numero.textContent = '0'

  const texto = doc.createElement('span')
  texto.textContent = ` ${rotulo}`

  wrap.append(numero, texto)
  return wrap
}
