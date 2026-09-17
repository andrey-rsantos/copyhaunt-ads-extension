import { diasAtivos } from './display'
import type { EstadoMineracao } from './miner'
import { AdStore } from './store'
import type { Ad } from './types'

export const CHAVE_RESULTADO = 'copyhaunt:resultado:v1'

export type OrdenacaoResultado = 'tempo' | 'colacao' | 'anunciante'

export interface ResultadoPersistidoV1 {
  versao: 1
  salvoEm: string
  origem: string
  estado: EstadoMineracao
  anuncios: Array<Omit<Ad, 'iniciouEm'> & { iniciouEm: string }>
}

export interface ResultadoLocal {
  salvoEm: Date
  origem: string
  estado: EstadoMineracao
  anuncios: Ad[]
}

const ESTADOS: ReadonlySet<EstadoMineracao> = new Set([
  'parado',
  'minerando',
  'pausado',
  'concluido',
  'esgotado',
  'incompreensivel',
  'limite-seguranca',
])

export function serializarResultado(resultado: ResultadoLocal): ResultadoPersistidoV1 {
  return {
    versao: 1,
    salvoEm: resultado.salvoEm.toISOString(),
    origem: resultado.origem,
    estado: resultado.estado,
    anuncios: resultado.anuncios.map((anuncio) => ({
      ...anuncio,
      iniciouEm: anuncio.iniciouEm.toISOString(),
    })),
  }
}

export function hidratarResultado(valor: unknown): ResultadoLocal | null {
  if (!ehObjeto(valor) || valor.versao !== 1) return null
  if (
    typeof valor.salvoEm !== 'string' ||
    !dataValida(valor.salvoEm) ||
    typeof valor.origem !== 'string' ||
    !ESTADOS.has(valor.estado as EstadoMineracao) ||
    !Array.isArray(valor.anuncios)
  ) {
    return null
  }

  const anuncios: Ad[] = []
  for (const candidato of valor.anuncios) {
    if (!ehAnuncioPersistido(candidato)) return null
    anuncios.push({
      ...candidato,
      iniciouEm: new Date(candidato.iniciouEm),
    })
  }

  return {
    salvoEm: new Date(valor.salvoEm),
    origem: valor.origem,
    estado: valor.estado as EstadoMineracao,
    anuncios,
  }
}

export function ordenarAnuncios(
  anuncios: Ad[],
  ordenacao: OrdenacaoResultado,
  agora: Date,
): Ad[] {
  const store = new AdStore()
  store.adicionar(anuncios)

  return anuncios
    .map((anuncio, indice) => ({ anuncio, indice }))
    .sort((a, b) => {
      const valorA = valorDaOrdenacao(a.anuncio, ordenacao, store, agora)
      const valorB = valorDaOrdenacao(b.anuncio, ordenacao, store, agora)
      return valorB - valorA || a.indice - b.indice
    })
    .map(({ anuncio }) => anuncio)
}

function valorDaOrdenacao(
  anuncio: Ad,
  ordenacao: OrdenacaoResultado,
  store: AdStore,
  agora: Date,
): number {
  if (ordenacao === 'tempo') return diasAtivos(anuncio.iniciouEm, agora)
  if (ordenacao === 'colacao') return store.colacaoDe(anuncio)
  return store.presenca(anuncio.anunciante.pageId)
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}

function dataValida(valor: string): boolean {
  return Number.isFinite(new Date(valor).getTime())
}

function ehAnuncioPersistido(valor: unknown): valor is Omit<Ad, 'iniciouEm'> & {
  iniciouEm: string
} {
  if (!ehObjeto(valor)) return false
  if (
    typeof valor.id !== 'string' ||
    valor.id.length === 0 ||
    typeof valor.iniciouEm !== 'string' ||
    !dataValida(valor.iniciouEm) ||
    !ehObjeto(valor.anunciante) ||
    typeof valor.anunciante.pageId !== 'string' ||
    typeof valor.anunciante.pageName !== 'string' ||
    !Array.isArray(valor.midias) ||
    typeof valor.ativo !== 'boolean' ||
    typeof valor.colacao !== 'number' ||
    !Array.isArray(valor.plataformas)
  ) {
    return false
  }
  return true
}
