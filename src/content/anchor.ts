/**
 * O ID da biblioteca é a âncora entre o DOM e os dados.
 *
 * Sem `\b` no fim de propósito: `textContent` concatena sem espaço, e o
 * número encosta na palavra seguinte (`...183805Started running`). Como
 * dígito e letra são ambos caracteres de palavra, `\b` não casaria ali.
 */
export const PADRAO_LIBRARY_ID = /(?<!\d)(\d{15,17})(?!\d)/

export function extrairLibraryId(texto: string): string | null {
  return texto.match(PADRAO_LIBRARY_ID)?.[1] ?? null
}

function contarIds(texto: string): number {
  const g = new RegExp(PADRAO_LIBRARY_ID.source, 'g')
  return new Set(texto.match(g) ?? []).size
}

/**
 * Encontra os cards e os indexa pelo ID da biblioteca.
 *
 * A regra: sobe a partir da folha que contém o ID enquanto o ancestral ainda
 * contiver **exatamente um** ID. O último que satisfaz isso é o card.
 *
 * Não depende de classe CSS, de rótulo nem de profundidade fixa — quando a
 * Meta mexer no aninhamento, a regra se ajusta sozinha.
 */
export function acharCards(raiz: ParentNode): Map<string, HTMLElement> {
  const cards = new Map<string, HTMLElement>()

  for (const el of Array.from(raiz.querySelectorAll('span, div, a'))) {
    if (el.children.length > 0) continue
    const id = extrairLibraryId(el.textContent ?? '')
    if (!id || cards.has(id)) continue

    let card = el as HTMLElement
    let pai = card.parentElement
    while (pai && contarIds(pai.textContent ?? '') === 1) {
      card = pai
      pai = card.parentElement
    }
    cards.set(id, card)
  }

  return cards
}

/** O container da grade é o pai comum dos cards. */
export function acharGrade(
  cards: Map<string, HTMLElement>,
): HTMLElement | null {
  const primeiro = cards.values().next().value
  return primeiro?.parentElement ?? null
}
