import { lerFaixaDaUrl, rotuloDaFaixa } from './dateFilter'

/**
 * A linha "Vai varrer", que declara a URL herdada.
 *
 * **Não é decoração** (spec, 7.2). Sem ela o usuário aperta Minerar sem
 * perceber que os filtros da Meta estão valendo — e essa herança é o que faz
 * o desenho inteiro funcionar, já que o nosso painel deixou de ter campos de
 * mercado, plataforma, formato e status.
 */

const PAISES: Record<string, string> = {
  ALL: 'Todos os países',
  BR: 'Brasil',
  PT: 'Portugal',
  US: 'Estados Unidos',
}

const FORMATOS: Record<string, string> = {
  video: 'Vídeo',
  image: 'Imagem',
  meme: 'Imagem e texto',
}

const STATUS: Record<string, string> = {
  active: 'Ativos',
  inactive: 'Inativos',
  all: 'Ativos e inativos',
}

export function descreverBusca(url: string, agora: Date): string {
  const p = new URL(url).searchParams
  const partes: string[] = []

  const termo = p.get('q')?.trim()
  partes.push(termo ? termo : '(busca vazia)')

  const pais = p.get('country')
  if (pais) partes.push(PAISES[pais] ?? pais)

  const formato = p.get('media_type')
  if (formato && formato !== 'all') partes.push(FORMATOS[formato] ?? formato)

  const status = p.get('active_status')
  if (status) partes.push(STATUS[status] ?? status)

  const faixa = lerFaixaDaUrl(url, agora)
  if (faixa.diasMin !== null || faixa.diasMax !== null) {
    partes.push(rotuloDaFaixa(faixa))
  }

  return partes.join(' · ')
}
