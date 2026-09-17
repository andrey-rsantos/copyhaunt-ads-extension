import { useEffect, useRef, type ReactElement } from 'react'
import { montarDestinos, type DestinoOpen } from '../core/links'
import type { Ad } from '../core/types'

interface LinksMenuProps {
  ad: Ad
  aberto: boolean
  aoAlternar: (aberto: boolean) => void
}

export function LinksMenu({ ad, aberto, aoAlternar }: LinksMenuProps): ReactElement {
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
            <ItemDestino key={destino.chave} destino={destino} />
          ))}
        </div>
      )}
    </div>
  )
}

function ItemDestino({ destino }: { destino: DestinoOpen }): ReactElement {
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
