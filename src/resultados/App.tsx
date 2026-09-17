import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { RespostaInstagram } from '../core/instagram-ponte'
import { AdStore } from '../core/store'
import {
  ordenarAnuncios,
  rotuloDoResultado,
  type OrdenacaoResultado,
  type ResultadoLocal,
} from '../core/resultados'
import {
  atualizarInstagramResultado,
  carregarResultado,
  criarStorageChrome,
  type StorageLocal,
} from '../storage/resultados'
import { CartaoResultado } from './CartaoResultado'
import type { EstadoInstagram } from './LinksMenu'

export interface AppProps {
  storage?: StorageLocal
  agora?: () => Date
}

const ROTULOS_ORDENACAO: Array<{ chave: OrdenacaoResultado; rotulo: string }> = [
  { chave: 'tempo', rotulo: 'Mais dias ativos' },
  { chave: 'colacao', rotulo: 'Mais criativos repetidos' },
  { chave: 'anunciante', rotulo: 'Mais anúncios do anunciante' },
]

export function App({ storage, agora }: AppProps): ReactElement {
  const [resultado, setResultado] = useState<ResultadoLocal | null | undefined>(undefined)
  const [ordenacao, setOrdenacao] = useState<OrdenacaoResultado>('tempo')
  const [menuAberto, setMenuAberto] = useState<string | null>(null)
  const [referencia] = useState(() => (agora ? agora() : new Date()))
  const [storageAtual] = useState(() => storage ?? criarStorageChrome())
  // Estado da busca por anunciante. `encontrado` não entra aqui: o perfil vai
  // para o próprio snapshot, e o menu vira link sozinho.
  const [buscas, setBuscas] = useState<ReadonlyMap<string, EstadoInstagram>>(new Map())
  // Uma consulta em voo por anunciante: dois cards do mesmo pageId dividem a mesma.
  const pendentes = useRef(new Map<string, Promise<void>>())

  useEffect(() => {
    let montado = true
    void carregarResultado(storageAtual).then((carregado) => {
      if (montado) setResultado(carregado)
    })
    return () => {
      montado = false
    }
  }, [storageAtual])

  const marcar = (pageId: string, estado: EstadoInstagram): void => {
    setBuscas((atual) => new Map(atual).set(pageId, estado))
  }

  /** Só no clique. Nada aqui faz `fetch`: a consulta acontece na Biblioteca. */
  const buscarInstagram = (pageId: string): void => {
    if (!resultado || pendentes.current.has(pageId)) return
    marcar(pageId, 'buscando')

    const consulta = pedirInstagram(pageId, resultado.origem)
      .then(async (resposta) => {
        if (!resposta.ok) return marcar(pageId, 'falha')
        if (resposta.url === null) return marcar(pageId, 'ausente')

        const url = resposta.url
        if (!(await atualizarInstagramResultado(pageId, url, storageAtual))) {
          return marcar(pageId, 'falha')
        }
        setResultado((atual) =>
          atual
            ? {
                ...atual,
                anuncios: atual.anuncios.map((a) =>
                  a.anunciante.pageId === pageId
                    ? { ...a, anunciante: { ...a.anunciante, instagram: url } }
                    : a,
                ),
              }
            : atual,
        )
        marcar(pageId, 'encontrado')
      })
      .catch(() => marcar(pageId, 'falha'))
      .finally(() => pendentes.current.delete(pageId))
    pendentes.current.set(pageId, consulta)
  }

  if (resultado === undefined) {
    return <main className="resultados-app"><p>Carregando resultados…</p></main>
  }

  return (
    <main className="resultados-app">
      <header className="resultados-cabecalho">
        <div>
          <div className="marca">Copy<span>Haunt</span></div>
          <p className="eyebrow">PAINEL DE INTELIGÊNCIA DE ANÚNCIOS</p>
        </div>
        {resultado && (
          <div className="resultado-resumo">
            <strong className="resultado-estado" data-testid="resultado-estado">
              {rotuloDoResultado(resultado.estado)}
            </strong>
            <strong>{resultado.anuncios.length} aprovados</strong>
            <span>
              {descreverOrigem(resultado.origem)}{' '}
              <a href={resultado.origem} target="_blank" rel="noreferrer">
                abrir busca
              </a>
            </span>
            <time dateTime={resultado.salvoEm.toISOString()}>
              Salvo em {formatarData(resultado.salvoEm)}
            </time>
          </div>
        )}
      </header>

      {!resultado ? (
        <EstadoVazio />
      ) : (
        <>
          <div className="resultados-controles">
            <label htmlFor="ordenacao">Ordenar por</label>
            <select
              id="ordenacao"
              data-testid="ordenacao"
              value={ordenacao}
              onChange={(evento) => {
                setOrdenacao(evento.target.value as OrdenacaoResultado)
                setMenuAberto(null)
              }}
            >
              {ROTULOS_ORDENACAO.map((opcao) => (
                <option key={opcao.chave} value={opcao.chave}>
                  {opcao.rotulo}
                </option>
              ))}
            </select>
          </div>
          <GradeResultados
            resultado={resultado}
            ordenacao={ordenacao}
            agora={referencia}
            menuAberto={menuAberto}
            aoAbrirMenu={setMenuAberto}
            buscas={buscas}
            aoBuscarInstagram={buscarInstagram}
          />
        </>
      )}
    </main>
  )
}

function GradeResultados({
  resultado,
  ordenacao,
  agora,
  menuAberto,
  aoAbrirMenu,
  buscas,
  aoBuscarInstagram,
}: {
  resultado: ResultadoLocal
  ordenacao: OrdenacaoResultado
  agora: Date
  menuAberto: string | null
  aoAbrirMenu: (id: string | null) => void
  buscas: ReadonlyMap<string, EstadoInstagram>
  aoBuscarInstagram: (pageId: string) => void
}): ReactElement {
  const anuncios = ordenarAnuncios(resultado.anuncios, ordenacao, agora)
  const store = useMemo(() => {
    const indice = new AdStore()
    indice.adicionar(resultado.anuncios)
    return indice
  }, [resultado.anuncios])

  return (
    <section className="resultados-grade" aria-label="Anúncios aprovados">
      {anuncios.map((ad) => (
        <CartaoResultado
          key={ad.id}
          ad={ad}
          agora={agora}
          colacao={store.colacaoDe(ad)}
          presenca={store.presenca(ad.anunciante.pageId)}
          linksAbertos={menuAberto === ad.id}
          aoAlternarLinks={(aberto) => aoAbrirMenu(aberto ? ad.id : null)}
          estadoInstagram={buscas.get(ad.anunciante.pageId)}
          aoBuscarInstagram={() => aoBuscarInstagram(ad.anunciante.pageId)}
        />
      ))}
    </section>
  )
}

function EstadoVazio(): ReactElement {
  return (
    <section className="resultado-vazio">
      <div className="vazio-glifo">◌</div>
      <h1>Nenhuma mineração concluída</h1>
      <p>
        Quando você aprovar anúncios em uma mineração, eles aparecerão aqui para
        revisão.
      </p>
      <a href="https://www.facebook.com/ads/library/" target="_blank" rel="noreferrer">
        Abrir Biblioteca de Anúncios
      </a>
    </section>
  )
}

/**
 * Pede ao service worker. `lastError` e resposta vazia viram falha controlada;
 * a página nunca vê HTML, token ou resposta bruta — só `ok/url`.
 */
function pedirInstagram(pageId: string, origem: string): Promise<RespostaInstagram> {
  return new Promise((resolver) => {
    chrome.runtime.sendMessage(
      { tipo: 'buscar-instagram', pageId, origem },
      (resposta: RespostaInstagram | undefined) => {
        if (chrome.runtime.lastError || !resposta) {
          resolver({ ok: false, motivo: 'conteudo-indisponivel' })
          return
        }
        resolver(resposta)
      },
    )
  })
}

function formatarData(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(data)
}

/** A URL da Biblioteca é longa demais para o cabeçalho; o termo pesquisado basta. */
function descreverOrigem(origem: string): string {
  try {
    const termo = new URL(origem).searchParams.get('q')
    return termo ? `Busca por “${termo}”` : 'Busca na Biblioteca'
  } catch {
    return 'Busca na Biblioteca'
  }
}
