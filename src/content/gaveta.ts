/**
 * A mecânica das gavetas dos enxertos.
 *
 * Uma aberta por vez (spec, 7.1). Este módulo não sabe o que vai dentro:
 * recebe um elemento pronto e cuida de mostrar, trocar e esconder.
 *
 * Tudo acontece dentro do shadow root dos enxertos, então nada aqui pode
 * vazar para o DOM da Meta nem sofrer o CSS dela.
 */

const CLASSE = 'gaveta'
const ATRIBUTO_DONO = 'data-dono'

/** A `chave` do botão dono da gaveta aberta, ou null. */
export function gavetaAberta(shadow: ShadowRoot): string | null {
  const g = shadow.querySelector(`.${CLASSE}`)
  return g?.getAttribute(ATRIBUTO_DONO) ?? null
}

export function fecharGaveta(shadow: ShadowRoot): void {
  const g = shadow.querySelector(`.${CLASSE}`)
  if (!g) return

  const dono = g.getAttribute(ATRIBUTO_DONO)
  if (dono) {
    const botao = shadow.querySelector<HTMLElement>(`[data-chave="${dono}"]`)
    delete botao?.dataset.aberto
  }
  g.remove()
}

export function abrirGaveta(
  shadow: ShadowRoot,
  botao: HTMLElement,
  conteudo: HTMLElement,
): void {
  // Fechar antes de abrir é o que garante "uma por vez" sem cada chamador
  // ter de lembrar disso.
  fecharGaveta(shadow)

  const chave = botao.dataset.chave ?? ''
  const g = document.createElement('div')
  g.className = CLASSE
  g.setAttribute(ATRIBUTO_DONO, chave)
  // Clique dentro da gaveta não pode fechar a gaveta nem chegar à Meta.
  g.addEventListener('click', (ev) => ev.stopPropagation())
  g.appendChild(conteudo)

  shadow.appendChild(g)
  botao.dataset.aberto = '1'
}

/**
 * O gesto do botão: abre, ou fecha se já for a dele.
 *
 * `montar` só é chamado quando a gaveta vai de fato abrir. Montar para
 * depois descartar seria construir DOM à toa a cada segundo clique.
 */
export function alternarGaveta(
  shadow: ShadowRoot,
  botao: HTMLElement,
  montar: () => HTMLElement,
): void {
  const chave = botao.dataset.chave ?? ''
  if (gavetaAberta(shadow) === chave) {
    fecharGaveta(shadow)
    return
  }
  abrirGaveta(shadow, botao, montar())
}
