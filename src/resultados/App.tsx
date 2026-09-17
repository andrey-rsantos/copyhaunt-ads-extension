import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { AdStore } from '../core/store'
import {
  ordenarAnuncios,
  type OrdenacaoResultado,
  type ResultadoLocal,
} from '../core/resultados'
import {
  carregarResultado,
  criarStorageChrome,
  type StorageLocal,
} from '../storage/resultados'
import { CartaoResultado } from './CartaoResultado'

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

  useEffect(() => {
    let montado = true
    void carregarResultado(storageAtual).then((carregado) => {
      if (montado) setResultado(carregado)
    })
    return () => {
      montado = false
    }
  }, [storageAtual])

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
}: {
  resultado: ResultadoLocal
  ordenacao: OrdenacaoResultado
  agora: Date
  menuAberto: string | null
  aoAbrirMenu: (id: string | null) => void
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
