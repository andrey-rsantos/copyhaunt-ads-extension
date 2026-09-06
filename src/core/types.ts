export type FormatoMidia = 'video' | 'imagem'

export interface Midia {
  formato: FormatoMidia
  /** Melhor qualidade disponível. Nunca vazio. */
  alta: string
  /** Versão leve, para pré-visualização. Cai para `alta` se não houver. */
  baixa: string
}

export interface Anunciante {
  pageId: string
  pageName: string
  /** Perfil no Facebook, quando a Meta informa. */
  perfil?: string
  /**
   * Perfil no Instagram. Não vem na resposta de busca — ver a pendência
   * registrada no plano do normalizador.
   */
  instagram?: string
}

/**
 * Um anúncio, no vocabulário do CopyHaunt.
 *
 * Todo o sistema fala este tipo. Só `normalize.ts` conhece o formato da Meta,
 * e é lá que o conserto acontece quando o schema deles mudar.
 */
export interface Ad {
  /** ad_archive_id: o número que a Meta mostra no card. */
  id: string
  /** Quando a veiculação começou. */
  iniciouEm: Date
  /** Quantos anúncios usam este mesmo criativo. Mínimo 1. */
  colacao: number
  anunciante: Anunciante
  /** URL de destino real, com parâmetros de campanha. */
  destino?: string
  /** Texto principal do criativo. */
  texto?: string
  titulo?: string
  /** Chamada para ação, como "Saiba mais". */
  cta?: string
  midias: Midia[]
  /** Facebook, Instagram, Messenger… como a Meta nomeia. */
  plataformas: string[]
  ativo: boolean
}
