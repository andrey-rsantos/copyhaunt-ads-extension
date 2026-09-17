import { useEffect, useRef, type ReactElement } from 'react'
import { montarDestinos, type DestinoOpen } from '../core/links'
import type { Ad } from '../core/types'

/** O item Instagram sem URL: só `desconhecido` é clicável, e só ele consulta. */
export type EstadoInstagram =
  | 'desconhecido'
  | 'buscando'
  | 'encontrado'
  | 'ausente'
  | 'falha'

const TEXTO_INSTAGRAM: Record<Exclude<EstadoInstagram, 'encontrado'>, string> = {
  desconhecido: 'Buscar Instagram',
  buscando: 'Buscando Instagram…',
  ausente: 'Instagram não encontrado',
  falha: 'Não foi possível buscar Instagram',
}

interface LinksMenuProps {
  ad: Ad
  aberto: boolean
  aoAlternar: (aberto: boolean) => void
  estadoInstagram?: EstadoInstagram
  aoBuscarInstagram?: () => void
}

export function LinksMenu({
  ad,
  aberto,
  aoAlternar,
  estadoInstagram = 'desconhecido',
  aoBuscarInstagram,
}: LinksMenuProps): ReactElement {
  const raiz = useRef<HTMLDivElement>(null)
  const destinos = montarDestinos(ad)

  useEffect(() => {
    if (!aberto) return
    const fecharAoClicarFora = (evento: MouseEvent): void => {
      if (!raiz.current?.contains(evento.target as Node)) aoAlternar(false)
    }
    document.addEventListener('click', fecharAoClicarFora)
    return () => document.removeEventListener('click', fecharAoClicarFora)
  }, [aberto, aoAlternar])

  return (
    <div className="links-menu" ref={raiz}>
      <button
        type="button"
        data-acao="links"
        aria-expanded={aberto}
        onClick={(evento) => {
          evento.stopPropagation()
          aoAlternar(!aberto)
        }}
      >
        Links
      </button>
      {aberto && (
        <div className="links-list" role="menu">
          {destinos.map((destino) => (
            <ItemDestino
              key={destino.chave}
              destino={destino}
              estadoInstagram={estadoInstagram}
              aoBuscarInstagram={aoBuscarInstagram}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ItemDestino({
  destino,
  estadoInstagram,
  aoBuscarInstagram,
}: {
  destino: DestinoOpen
  estadoInstagram: EstadoInstagram
  aoBuscarInstagram?: () => void
}): ReactElement {
  if (destino.url) {
    return (
      <a
        data-link-chave={destino.chave}
        href={destino.url}
        target="_blank"
        rel="noreferrer"
        role="menuitem"
      >
        {destino.rotulo}
      </a>
    )
  }

  // Instagram sem URL é ação, não falta de dado: a consulta só sai no clique.
  if (destino.chave === 'instagram' && estadoInstagram !== 'encontrado') {
    return (
      <button
        type="button"
        data-link-chave={destino.chave}
        data-estado={estadoInstagram}
        disabled={estadoInstagram !== 'desconhecido'}
        onClick={(evento) => {
          evento.stopPropagation()
          aoBuscarInstagram?.()
        }}
      >
        {TEXTO_INSTAGRAM[estadoInstagram]}
      </button>
    )
  }

  return (
    <button
      type="button"
      data-link-chave={destino.chave}
      disabled
      title="Faça a busca na Biblioteca de Anúncios"
    >
      {destino.rotulo} <small>Abrir na Biblioteca</small>
    </button>
  )
}
