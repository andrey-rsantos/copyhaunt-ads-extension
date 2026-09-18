import { avaliar, type Criterios } from '../core/criteria'
import type { AdStore } from '../core/store'
import { acharCards } from './anchor'
import { destacarCriativoRepetido } from './destaque'
import { aplicarVeredito, plantarBandeja } from './tray'

export interface ResumoOverlay {
  plantados: number
  aprovados: number
  escondidos: number
}

/**
 * Percorre a grade e pinta cada card cujo anúncio já esteja indexado.
 *
 * Cards sem anúncio conhecido ficam intocados: o payload pode chegar depois
 * do DOM, e mexer neles agora seria esconder o que ainda vamos aprovar.
 */
export function pintarGrade(
  raiz: ParentNode,
  store: AdStore,
  criterios: Criterios,
  agora: Date,
  esconderReprovados: boolean,
): ResumoOverlay {
  const resumo: ResumoOverlay = { plantados: 0, aprovados: 0, escondidos: 0 }

  for (const [id, card] of acharCards(raiz)) {
    const ad = store.obter(id)
    if (!ad) continue

    plantarBandeja(card, ad, agora)
    destacarCriativoRepetido(card)
    resumo.plantados += 1

    const veredito = avaliar(ad, criterios, {
      presenca: store.presenca(ad.anunciante.pageId),
      colacao: store.colacaoDe(ad),
      agora,
    })

    if (veredito.passa) {
      aplicarVeredito(card, true)
      resumo.aprovados += 1
    } else if (esconderReprovados) {
      aplicarVeredito(card, false)
      resumo.escondidos += 1
    }
  }

  return resumo
}
