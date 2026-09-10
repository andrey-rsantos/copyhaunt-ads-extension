/**
 * A gaveta do `?`: exemplos, sem regras nem jargão (spec, 7.5).
 *
 * **Não há aviso de operadores.** Detectar `and`/`or` e alertar foi proposto
 * e recusado em 2026-09-10: os exemplos ensinam o padrão certo, e um alerta a
 * mais pesa contra quem só quer buscar. A medição fica registrada para o caso
 * de a decisão precisar ser revista — `receitas and api.whatsapp.com` devolve
 * 0 resultados contra ~9.700 sem o `and`.
 */

export const EXEMPLOS = [
  { termo: 'receitas', explica: 'anúncios sobre receitas' },
  {
    termo: 'receitas api.whatsapp.com',
    explica: 'receitas que vendem por WhatsApp',
  },
  { termo: '"receita de bolo"', explica: 'a frase exata, nessa ordem' },
  { termo: 'hotmart.com', explica: 'anúncios que levam para a Hotmart' },
  {
    termo: 'emagrecimento kiwify.com',
    explica: 'emagrecimento vendido pela Kiwify',
  },
] as const

export function montarExemplos(
  doc: Document,
  aoEscolher: (termo: string) => void,
): HTMLElement {
  const raiz = doc.createElement('div')

  const titulo = doc.createElement('h3')
  titulo.textContent = 'Exemplos de busca'
  raiz.appendChild(titulo)

  for (const e of EXEMPLOS) {
    const linha = doc.createElement('div')
    linha.className = 'linha'
    linha.dataset.termo = e.termo
    linha.style.cursor = 'pointer'

    const termo = doc.createElement('strong')
    termo.textContent = e.termo

    const explica = doc.createElement('span')
    explica.textContent = e.explica
    explica.style.color = '#C4A7FF'

    linha.append(termo, explica)
    linha.addEventListener('click', () => aoEscolher(e.termo))
    raiz.appendChild(linha)
  }

  return raiz
}

/**
 * Escreve o termo no campo de busca da Meta.
 *
 * O `value` é escrito pelo setter do protótipo, e não pela propriedade: o
 * React guarda o valor anterior no nó e ignora uma atribuição direta, então
 * o campo mostraria o texto e o estado interno dele continuaria vazio.
 *
 * O campo é buscado agora, nunca guardado: a Meta troca esse nó a cada busca
 * nova — medido em 2026-09-10.
 */
export function escreverNaBusca(doc: Document, termo: string): boolean {
  const campo = doc.querySelector<HTMLInputElement>('input[type="search"]')
  if (!campo) return false

  const janela = doc.defaultView
  const setter = janela
    ? Object.getOwnPropertyDescriptor(
        janela.HTMLInputElement.prototype,
        'value',
      )?.set
    : undefined

  if (setter) setter.call(campo, termo)
  else campo.value = termo

  campo.dispatchEvent(new Event('input', { bubbles: true }))
  campo.focus()
  return true
}
