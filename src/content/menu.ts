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
  /**
   * Impede o fechamento ao escolher.
   *
   * Existe para o item que precisa dar notícia depois: a busca do Instagram
   * demora ~2 s, e um menu fechado não teria onde mostrar o resultado.
   */
  mantemAberto?: boolean
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
        if (!item.mantemAberto) fecharMenu(raiz)
        aoEscolher(item)
      })
    }

    menu.appendChild(linha)
  }

  raiz.appendChild(menu)
}

export interface MudancaItem {
  rotulo: string
  /** `apagado` também remove a ação: o item vira aviso, não botão. */
  estado: 'buscando' | 'achou' | 'apagado'
  /**
   * O que fazer no próximo clique.
   *
   * Obrigatório na prática para o estado `achou`: a troca abaixo descarta os
   * listeners antigos, e sem isto o item viraria um rótulo bonito e morto.
   */
  aoClicar?: () => void
}

/**
 * Troca o texto e o estado de um item do menu aberto.
 *
 * Idempotente e tolerante ao menu já fechado: a resposta pode chegar depois
 * de o usuário clicar em outro lugar, e isso é uso normal, não erro.
 *
 * Substituir a linha por um clone raso descarta os listeners de uma vez —
 * mais barato que rastrear qual foi registrado. O preço é que a ação nova
 * precisa vir junto, em `aoClicar`.
 */
export function atualizarItem(
  raiz: ParentNode,
  chave: string,
  mudanca: MudancaItem,
): void {
  const linha = raiz.querySelector(`.menu .item[data-chave="${chave}"]`)
  if (!linha) return

  const nova = linha.cloneNode(false) as HTMLElement
  nova.textContent = mudanca.rotulo
  nova.dataset.estado = mudanca.estado
  if (mudanca.estado === 'apagado') nova.dataset.desabilitado = 'sim'
  else delete nova.dataset.desabilitado

  if (mudanca.aoClicar && mudanca.estado !== 'apagado') {
    nova.addEventListener('click', (evento) => {
      // A Meta escuta clique no card inteiro: sem isto, escolher um item
      // abriria o anúncio deles junto.
      evento.stopPropagation()
      evento.preventDefault()
      mudanca.aoClicar!()
    })
  }

  linha.replaceWith(nova)
}
