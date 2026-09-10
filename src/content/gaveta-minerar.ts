import { descreverBusca } from '../core/busca-descrita'
import { CRITERIOS_PADRAO, type Criterios } from '../core/criteria'
import { lerFaixaDaUrl } from '../core/dateFilter'

/**
 * A gaveta do Minerar: os critérios que só nós temos, mais o alvo.
 *
 * Mercado, plataforma, formato e status não estão aqui de propósito — são da
 * Meta, e vivem na barra dela (spec, 7.3). O tempo ativo também não: quem o
 * define é o calendário, que reescreve a URL, e daqui ele é apenas herdado.
 *
 * O toggle "Possui Instagram" é pós-filtro, nunca pré-filtro (spec, 6.4): ele
 * roda depois do laço, sobre os aprovados. A gaveta diz isso em uma linha,
 * porque o total final pode diminuir e isso precisa ser esperado.
 */

export interface PedidoMineracao {
  criterios: Criterios
  limiteEncontrados: number
  /** Pós-filtro: descarta aprovados sem Instagram, ao fim da varredura. */
  exigirInstagram: boolean
}

export function montarMinerar(
  doc: Document,
  urlAtual: string,
  agora: Date,
  aoIniciar: (pedido: PedidoMineracao) => void,
): HTMLElement {
  const raiz = doc.createElement('div')

  const titulo = doc.createElement('h3')
  titulo.textContent = 'Minerar'
  raiz.appendChild(titulo)

  const colacao = campo(doc, 'colacaoMinima', CRITERIOS_PADRAO.colacaoMinima)
  const presenca = campo(doc, 'presencaMinima', CRITERIOS_PADRAO.presencaMinima)
  const alvo = campo(doc, 'limiteEncontrados', 100)

  const instagram = doc.createElement('input')
  instagram.type = 'checkbox'
  instagram.dataset.campo = 'exigirInstagram'

  raiz.appendChild(linha(doc, 'Criativos repetidos', colacao))
  raiz.appendChild(linha(doc, 'Anúncios do anunciante', presenca))
  raiz.appendChild(linha(doc, 'Possui Instagram', instagram))

  const notaIg = doc.createElement('div')
  notaIg.className = 'nota'
  notaIg.dataset.papel = 'nota-instagram'
  // Exigido pela seção 7.2: o total final pode diminuir, e o usuário precisa
  // saber disso antes de apertar, não depois.
  notaIg.textContent =
    'Verificado ao final, só nos anúncios aprovados — depois da varredura. Pode reduzir o total.'
  raiz.appendChild(notaIg)

  raiz.appendChild(linha(doc, 'Quantidade de aprovados', alvo))

  const resumo = doc.createElement('div')
  resumo.className = 'nota'
  resumo.dataset.papel = 'vai-varrer'
  resumo.textContent = `Vai varrer: ${descreverBusca(urlAtual, agora)}`
  raiz.appendChild(resumo)

  const aviso = doc.createElement('div')
  aviso.className = 'nota'
  aviso.hidden = true
  raiz.appendChild(aviso)

  const iniciar = doc.createElement('button')
  iniciar.className = 'acao'
  iniciar.dataset.acao = 'iniciar'
  iniciar.textContent = '▶ Iniciar mineração'
  iniciar.addEventListener('click', () => {
    const limite = ler(alvo)

    // O motor lança `RangeError` fora de 1 a 100 (`miner.ts`, construtor).
    // Barrar aqui transforma exceção em recado.
    if (limite === null || limite < 1 || limite > 100) {
      aviso.hidden = false
      aviso.textContent = 'A quantidade de aprovados deve ser entre 1 e 100.'
      return
    }

    aviso.hidden = true
    const faixa = lerFaixaDaUrl(urlAtual, agora)

    aoIniciar({
      criterios: {
        colacaoMinima: ler(colacao),
        presencaMinima: ler(presenca),
        // Herdados da URL: quem os define é o calendário.
        diasMin: faixa.diasMin,
        diasMax: faixa.diasMax,
      },
      limiteEncontrados: limite,
      exigirInstagram: instagram.checked,
    })
  })
  raiz.appendChild(iniciar)

  return raiz
}

function campo(
  doc: Document,
  nome: string,
  valor: number | null,
): HTMLInputElement {
  const el = doc.createElement('input')
  el.type = 'number'
  el.min = '1'
  el.dataset.campo = nome
  el.value = valor === null ? '' : String(valor)
  el.style.cssText =
    'width:80px;padding:6px 8px;border-radius:8px;border:0;' +
    'background:#1A1622;color:#FFF;font:inherit'
  return el
}

function linha(doc: Document, texto: string, campo: HTMLElement): HTMLElement {
  const l = doc.createElement('div')
  l.className = 'linha'

  const rotulo = doc.createElement('span')
  rotulo.textContent = texto

  l.append(rotulo, campo)
  return l
}

/** Campo vazio é critério desligado (`criteria.ts`), e desligado é `null`. */
function ler(el: HTMLInputElement): number | null {
  const bruto = el.value.trim()
  if (bruto === '') return null

  const n = Number(bruto)
  return Number.isInteger(n) && n >= 1 ? n : null
}
