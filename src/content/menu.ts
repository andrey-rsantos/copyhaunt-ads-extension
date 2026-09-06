/**
 * O menu que serve aos dois botões.
 *
 * Copiar e OPEN têm o mesmo comportamento: uma lista, alguns itens
 * indisponíveis, escolher um faz algo e fecha. Escrever dois menus seria
 * decidir duas vezes como um menu se comporta.
 */
export interface ItemMenu {
  chave: string
  rotulo: string
  /** `null` desabilita o item, com o motivo no tooltip. */
  valor: string | null
}

/** Fecha o menu aberto nesta raiz, se houver. Idempotente. */
export function fecharMenu(raiz: ParentNode): void {
  raiz.querySelector('.menu')?.remove()
}

/**
 * Abre o menu, substituindo o que estivesse aberto.
 *
 * Item sem dado fica desabilitado, nunca oculto: a seção 7 do spec pede assim,
 * porque ocultar faria o menu mudar de tamanho a cada card.
 */
export function abrirMenu(
  raiz: ParentNode,
  itens: ItemMenu[],
  aoEscolher: (item: ItemMenu) => void,
): void {
  fecharMenu(raiz)

  const menu = document.createElement('div')
  menu.className = 'menu'

  for (const item of itens) {
    const linha = document.createElement('div')
    linha.className = 'item'
    linha.dataset.chave = item.chave
    linha.textContent = item.rotulo

    if (item.valor === null) {
      linha.dataset.desabilitado = 'sim'
      linha.title = 'Este anúncio não traz este dado'
    } else {
      linha.addEventListener('click', (evento) => {
        // A Meta escuta clique no card inteiro: sem isto, escolher um item
        // abriria o anúncio deles junto.
        evento.stopPropagation()
        evento.preventDefault()
        fecharMenu(raiz)
        aoEscolher(item)
      })
    }

    menu.appendChild(linha)
  }

  raiz.appendChild(menu)
}
