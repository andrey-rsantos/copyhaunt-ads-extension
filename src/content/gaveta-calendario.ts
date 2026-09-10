import { PRESETS, type FaixaDias } from '../core/dateFilter'

/**
 * A gaveta do calendário: o tempo ativo, que é o filtro que a Meta não
 * oferece direito (spec, 7.2).
 *
 * Dois campos e cinco atalhos. O slider desenhado no spec fica para quando
 * houver queixa dos campos: dois números fazem o mesmo trabalho, e um slider
 * de faixa com dois pontos é bem mais código do que este arquivo inteiro.
 *
 * ponytail: dois campos numéricos no lugar do slider de faixa do spec. Se o
 * ajuste fino incomodar, o slider entra sem mudar a interface deste módulo.
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

  const atalhos = doc.createElement('div')
  atalhos.className = 'linha'
  raiz.appendChild(atalhos)

  const campoMin = campoNumero(doc, 'diasMin', inicial.diasMin)
  const campoMax = campoNumero(doc, 'diasMax', inicial.diasMax)

  for (const p of PRESETS) {
    const atalho = doc.createElement('span')
    atalho.dataset.preset = String(p)
    atalho.textContent = `${p}+`
    atalho.style.cssText =
      'cursor:pointer;padding:4px 10px;border-radius:8px;' +
      'box-shadow:inset 0 0 0 1px rgba(196,167,255,0.4)'
    // O atalho move só o mínimo (spec, 7.2): quem já apertou uma faixa não
    // quer perder o outro lado ao clicar num número.
    atalho.addEventListener('click', () => {
      campoMin.value = String(p)
    })
    atalhos.appendChild(atalho)
  }

  raiz.appendChild(linhaRotulada(doc, 'No ar há pelo menos', campoMin))
  raiz.appendChild(linhaRotulada(doc, 'No ar há no máximo', campoMax))

  const aviso = doc.createElement('div')
  aviso.className = 'nota'
  aviso.hidden = true
  raiz.appendChild(aviso)

  const aplicar = doc.createElement('button')
  aplicar.className = 'acao'
  aplicar.dataset.acao = 'aplicar'
  aplicar.textContent = 'Aplicar na página'
  aplicar.addEventListener('click', () => {
    const faixa = {
      diasMin: lerCampo(campoMin),
      diasMax: lerCampo(campoMax),
    }

    if (
      faixa.diasMin !== null &&
      faixa.diasMax !== null &&
      faixa.diasMin > faixa.diasMax
    ) {
      // Faixa invertida devolveria interseção vazia, e a Biblioteca abriria
      // sem resultado nenhum — parece defeito nosso.
      aviso.hidden = false
      aviso.textContent = 'O mínimo não pode ser maior que o máximo.'
      return
    }

    aviso.hidden = true
    aoAplicar(faixa)
  })
  raiz.appendChild(aplicar)

  return raiz
}

function campoNumero(
  doc: Document,
  campo: string,
  valor: number | null,
): HTMLInputElement {
  const el = doc.createElement('input')
  el.type = 'number'
  el.min = '1'
  el.max = '365'
  el.dataset.campo = campo
  el.value = valor === null ? '' : String(valor)
  el.style.cssText =
    'width:80px;padding:6px 8px;border-radius:8px;border:0;' +
    'background:#1A1622;color:#FFF;font:inherit'
  return el
}

function linhaRotulada(
  doc: Document,
  texto: string,
  campo: HTMLElement,
): HTMLElement {
  const linha = doc.createElement('div')
  linha.className = 'linha'

  const rotulo = doc.createElement('span')
  rotulo.textContent = texto

  linha.append(rotulo, campo)
  return linha
}

/** Campo vazio é critério desligado, e desligado é `null` — nunca zero. */
function lerCampo(el: HTMLInputElement): number | null {
  const bruto = el.value.trim()
  if (bruto === '') return null

  const n = Number(bruto)
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : null
}
