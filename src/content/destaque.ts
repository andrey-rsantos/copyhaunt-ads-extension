const ATRIBUTO_COLACAO = 'data-copyhaunt-colacao'
const ATRIBUTO_ESTILO_ORIGINAL = 'data-copyhaunt-estilo-original'

const PADROES_COLACAO = [
  /(\d+)\s+anúncios?\s+usam\s+(?:esse|este)\s+criativo\b/i,
  /(\d+)\s+ads?\s+(?:use|uses)\s+this\s+creative\b/i,
]

type EstiloOriginal = {
  color: string
  fontWeight: string
  backgroundColor: string
  borderRadius: string
}

/** Destaca a mensagem da Meta quando o criativo aparece em pelo menos 2 ads. */
export function destacarCriativoRepetido(card: HTMLElement): void {
  limparDestaque(card)

  const elemento = encontrarMensagem(card)
  if (!elemento) return

  const original: EstiloOriginal = {
    color: elemento.style.color,
    fontWeight: elemento.style.fontWeight,
    backgroundColor: elemento.style.backgroundColor,
    borderRadius: elemento.style.borderRadius,
  }
  elemento.setAttribute(ATRIBUTO_ESTILO_ORIGINAL, JSON.stringify(original))
  elemento.dataset.copyhauntColacao = 'destacado'
  elemento.style.color = '#7C3AED'
  elemento.style.fontWeight = '600'
  elemento.style.backgroundColor = 'rgba(124, 58, 237, 0.08)'
  elemento.style.borderRadius = '6px'
}

function encontrarMensagem(card: HTMLElement): HTMLElement | null {
  const fila: ChildNode[] = [...card.childNodes]

  while (fila.length > 0) {
    const no = fila.shift()
    if (!no) continue

    if (no.nodeType === Node.TEXT_NODE) {
      const texto = no.textContent?.trim() ?? ''
      const quantidade = quantidadeDeColacao(texto)
      if (quantidade >= 2 && no.parentElement && no.parentElement !== card) {
        return no.parentElement
      }
      continue
    }

    fila.push(...no.childNodes)
  }

  return null
}

function quantidadeDeColacao(texto: string): number {
  for (const padrao of PADROES_COLACAO) {
    const quantidade = texto.match(padrao)?.[1]
    if (quantidade) return Number(quantidade)
  }
  return 0
}

function limparDestaque(card: HTMLElement): void {
  for (const elemento of card.querySelectorAll<HTMLElement>(
    `[${ATRIBUTO_COLACAO}]`,
  )) {
    const original = lerEstiloOriginal(elemento)
    if (original) {
      elemento.style.color = original.color
      elemento.style.fontWeight = original.fontWeight
      elemento.style.backgroundColor = original.backgroundColor
      elemento.style.borderRadius = original.borderRadius
    }
    delete elemento.dataset.copyhauntColacao
    delete elemento.dataset.copyhauntEstiloOriginal
  }
}

function lerEstiloOriginal(elemento: HTMLElement): EstiloOriginal | null {
  try {
    return JSON.parse(
      elemento.dataset.copyhauntEstiloOriginal ?? '',
    ) as EstiloOriginal
  } catch {
    return null
  }
}
