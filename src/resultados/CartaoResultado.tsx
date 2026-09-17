import { useState, type ReactElement } from 'react'
import { montarCopias } from '../core/copy'
import { baixarCriativos } from '../content/download'
import { diasAtivos, faixaBadge } from '../core/display'
import type { Ad } from '../core/types'
import { LinksMenu } from './LinksMenu'

interface CartaoResultadoProps {
  ad: Ad
  agora: Date
  colacao: number
  presenca: number
  linksAbertos: boolean
  aoAlternarLinks: (aberto: boolean) => void
}

export function CartaoResultado({
  ad,
  agora,
  colacao,
  presenca,
  linksAbertos,
  aoAlternarLinks,
}: CartaoResultadoProps): ReactElement {
  const [copiasAbertas, setCopiasAbertas] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const dias = diasAtivos(ad.iniciouEm, agora)
  const copias = montarCopias(ad)

  const baixar = async (): Promise<void> => {
    setBaixando(true)
    try {
      await baixarCriativos(ad, {
        buscar: (...args) => globalThis.fetch(...args),
        salvar: salvarArquivo,
      })
    } finally {
      setBaixando(false)
    }
  }

  return (
    <article
      className="resultado-card"
      data-testid="resultado-card"
      data-ad-id={ad.id}
    >
      <div className="resultado-preview">
        {ad.midias[0] ? (
          ad.midias[0].formato === 'video' ? (
            <video src={ad.midias[0].baixa} controls muted />
          ) : (
            <img src={ad.midias[0].baixa} alt="Preview do criativo" />
          )
        ) : (
          <span>Sem preview</span>
        )}
        <div className="resultado-badge" data-faixa={faixaBadge(dias)}>
          {dias} DIAS
        </div>
      </div>
      <div className="resultado-conteudo">
        <div className="resultado-anunciante">
          <span className="resultado-legenda">ANUNCIANTE</span>
          <strong>{ad.anunciante.pageName}</strong>
        </div>
        <div className="resultado-metricas">
          <span>{colacao} criativos repetidos</span>
          <span>{presenca} anúncios do anunciante</span>
        </div>
        <p className="resultado-copy">{ad.texto ?? ad.titulo ?? 'Sem copy disponível'}</p>
        <div className="resultado-plataformas">
          {ad.plataformas.map((plataforma) => (
            <span key={plataforma}>{plataforma}</span>
          ))}
        </div>
        <div className="resultado-acoes">
          <LinksMenu
            ad={ad}
            aberto={linksAbertos}
            aoAlternar={aoAlternarLinks}
          />
          <div className="copiar-menu">
            <button
              type="button"
              data-acao="copiar"
              onClick={() => setCopiasAbertas((aberta) => !aberta)}
            >
              Copiar
            </button>
            {copiasAbertas && (
              <div className="copiar-lista" role="menu">
                {copias.map((item) => (
                  <button
                    key={item.chave}
                    type="button"
                    data-copy-chave={item.chave}
                    disabled={!item.valor}
                    onClick={() => {
                      if (item.valor && navigator.clipboard) {
                        void navigator.clipboard.writeText(item.valor)
                      }
                    }}
                  >
                    {item.rotulo}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" data-acao="baixar" onClick={() => void baixar()} disabled={baixando}>
            {baixando ? 'Baixando…' : 'Baixar'}
          </button>
        </div>
      </div>
    </article>
  )
}

function salvarArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob)
  const ancora = document.createElement('a')
  ancora.href = url
  ancora.download = nome
  ancora.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
