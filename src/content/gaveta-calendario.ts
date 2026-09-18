import { PRESETS, type FaixaDias } from '../core/dateFilter'

/**
 * A gaveta de tempo ativo oferece decisões rápidas: o preset significa
 * "anúncios no ar há pelo menos X dias". O limite máximo deixou de fazer
 * parte do produto para não exigir que o usuário calibre uma faixa.
 */
export function montarCalendario(
  doc: Document,
  inicial: FaixaDias,
  aoAplicar: (faixa: FaixaDias) => void,
): HTMLElement {
  const raiz = doc.createElement('div')

  const titulo = doc.createElement('h3')
  titulo.textContent = 'Tempo ativo'
  raiz.appendChild(titulo)

  const descricao = doc.createElement('p')
  descricao.className = 'nota'
  descricao.textContent = 'Mostrar anúncios no ar há pelo menos:'
  raiz.appendChild(descricao)

  const atalhos = doc.createElement('div')
  atalhos.className = 'linha'
  raiz.appendChild(atalhos)

  let selecionado = inicial.diasMax === null ? inicial.diasMin : null
  const botoes: HTMLElement[] = []

  const atualizarSelecao = (valor: number | null): void => {
    selecionado = valor
    for (const botao of botoes) {
      const ativo =
        (valor === null && botao.dataset.preset === 'none') ||
        botao.dataset.preset === String(valor)
      botao.setAttribute('aria-pressed', String(ativo))
      botao.dataset.selecionado = String(ativo)
    }
  }

  const nenhum = botaoPreset(doc, 'none', 'Sem filtro')
  nenhum.addEventListener('click', () => atualizarSelecao(null))
  atalhos.appendChild(nenhum)
  botoes.push(nenhum)

  for (const preset of PRESETS) {
    const botao = botaoPreset(doc, String(preset), `${preset}+ Dias`)
    botao.addEventListener('click', () => atualizarSelecao(preset))
    atalhos.appendChild(botao)
    botoes.push(botao)
  }

  atualizarSelecao(selecionado)

  const aplicar = doc.createElement('button')
  aplicar.className = 'acao acao--primaria'
  aplicar.dataset.acao = 'aplicar'
  aplicar.textContent = 'Aplicar na página'
  aplicar.addEventListener('click', () => {
    aoAplicar({ diasMin: selecionado, diasMax: null })
  })
  raiz.appendChild(aplicar)

  return raiz
}

function botaoPreset(
  doc: Document,
  preset: string,
  texto: string,
): HTMLElement {
  const botao = doc.createElement('button')
  botao.type = 'button'
  botao.dataset.preset = preset
  botao.className = 'preset'
  botao.textContent = texto
  botao.setAttribute('aria-pressed', 'false')
  return botao
}
