import type { Ad, Midia } from './types'

/**
 * Como os criativos baixados se chamam.
 *
 * Módulo puro: nem DOM nem rede. O nome do arquivo é o que o usuário vê todo
 * dia na pasta de downloads, e é a parte que mais vale testar sem navegador.
 */

/**
 * As extensões que o fbcdn serve.
 *
 * O `(?=$|[?#])` existe porque a URL termina em parâmetros — `?_nc_cat=1&oh=…`
 * —, e sem ele o nome do arquivo herdaria metade da query.
 */
const EXTENSAO = /\.(mp4|mov|webm|jpe?g|png|webp|gif)(?=$|[?#])/i

/** Quantos caracteres do nome do anunciante cabem antes de virar ruído. */
const LIMITE_APELIDO = 40

function extensaoDe(midia: Midia): string {
  const achada = midia.alta.match(EXTENSAO)?.[1].toLowerCase()
  if (achada) return achada === 'jpeg' ? 'jpg' : achada
  // O fbcdn às vezes serve por caminho sem extensão. O formato já é conhecido,
  // e um palpite certo em 99% dos casos vale mais que um arquivo sem extensão
  // que o sistema não sabe abrir.
  return midia.formato === 'video' ? 'mp4' : 'jpg'
}

/**
 * O nome do anunciante reduzido ao que sobrevive a um sistema de arquivos.
 *
 * Acento vira letra simples, o resto vira hífen. Pode sobrar string vazia — um
 * nome só de emoji não deixa nada —, e quem chama trata esse caso.
 */
function apelido(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, LIMITE_APELIDO)
    .replace(/^-+|-+$/g, '')
}

/**
 * O nome sem extensão: anunciante mais ID do anúncio.
 *
 * O ID entra sempre porque é o que torna o nome único; o anunciante entra
 * porque, com trinta criativos na pasta, o ID sozinho não diz nada.
 */
function nomeBase(ad: Ad): string {
  const quem = apelido(ad.anunciante.pageName)
  return quem ? `${quem}-${ad.id}` : ad.id
}

/** O nome do arquivo quando o anúncio traz uma mídia só. */
export function nomeDoArquivo(ad: Ad, midia: Midia): string {
  return `${nomeBase(ad)}.${extensaoDe(midia)}`
}

/**
 * O nome de cada mídia dentro do ZIP.
 *
 * Só o número: o anunciante e o anúncio já estão no nome do pacote, e repetir
 * os dois em cada entrada seria ruído dentro de uma pasta que já os carrega.
 * O zero à esquerda é o que faz `10` vir depois de `2` na listagem.
 */
export function nomeNoPacote(indice: number, midia: Midia): string {
  return `${String(indice + 1).padStart(2, '0')}.${extensaoDe(midia)}`
}

/** O nome do ZIP quando o anúncio traz mais de uma mídia. */
export function nomeDoPacote(ad: Ad): string {
  return `${nomeBase(ad)}.zip`
}
