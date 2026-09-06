import type { Ad } from './types'

export interface ItemCopia {
  chave: string
  rotulo: string
  /** `null` quando o anúncio não traz o dado. O item continua na lista. */
  valor: string | null
}

/**
 * Os cinco itens do menu Copiar, sempre na mesma ordem.
 *
 * Espelha `montarDestinos` de propósito: mesma forma, mesma regra para dado
 * ausente. O menu que exibe os dois é o mesmo, e uma forma só evita duas.
 */
export function montarCopias(ad: Ad): ItemCopia[] {
  const partes = [ad.texto, ad.titulo, ad.descricao, ad.destino].filter(
    (p): p is string => Boolean(p),
  )

  return [
    { chave: 'texto', rotulo: 'Texto principal', valor: ad.texto ?? null },
    { chave: 'titulo', rotulo: 'Título', valor: ad.titulo ?? null },
    { chave: 'descricao', rotulo: 'Descrição', valor: ad.descricao ?? null },
    { chave: 'site', rotulo: 'URL do site', valor: ad.destino ?? null },
    // "Tudo" pula o que falta: um anúncio sem título não merece um buraco de
    // duas quebras de linha no meio do texto colado.
    {
      chave: 'tudo',
      rotulo: 'Tudo',
      valor: partes.length > 0 ? partes.join('\n\n') : null,
    },
  ]
}
