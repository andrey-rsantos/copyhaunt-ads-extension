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
  concluido: 'Concluído',
  esgotado: 'Fim dos resultados',
  incompreensivel: 'Mineração encerrada',
  'limite-seguranca': 'Mineração encerrada',
}

/** Estados em que não há mais o que pausar nem retomar. */
const TERMINAIS: ReadonlySet<EstadoMineracao> = new Set([
  'concluido',
  'esgotado',
  'incompreensivel',
  'limite-seguranca',
])

export function rotuloDoEstado(estado: EstadoMineracao): string {
  return ROTULOS[estado]
}

export function montarProgresso(
  doc: Document,
  aoPausar: () => void,
): HTMLElement {
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

  const pausar = doc.createElement('button')
  pausar.className = 'pausar'
  pausar.dataset.acao = 'pausar'
  pausar.textContent = 'Pausar'
  pausar.addEventListener('click', (ev) => {
    ev.stopPropagation()
    aoPausar()
  })

  cartao.append(
    estado,
    trilho,
    contador(doc, 'encontrados', 'encontrados'),
    contador(doc, 'analisados', 'analisados'),
    contador(doc, 'rolagens', 'rolagens'),
    pausar,
  )

  return cartao
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

  const pausar = cartao.querySelector<HTMLButtonElement>('[data-acao="pausar"]')
  if (pausar) {
    pausar.hidden = TERMINAIS.has(p.estado)
    pausar.textContent = p.estado === 'pausado' ? 'Retomar' : 'Pausar'
  }
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
