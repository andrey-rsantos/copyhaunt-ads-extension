import { CONFIG_EMBUTIDA, validarConfig, type ConfigRemota } from '../core/config'

/**
 * Onde a config mora.
 *
 * `raw.githubusercontent.com` responde com `Access-Control-Allow-Origin: *`,
 * não exige infraestrutura nova e atualizar a config vira um commit. Trocar de
 * hospedagem é mudar esta constante e o host no manifest.
 */
export const URL_CONFIG =
  'https://raw.githubusercontent.com/andrey-rsantos/copyhaunt-ads-extension/main/config/config.json'

/** Seis horas. A Meta não muda de hora em hora, e buscar por sessão bastaria. */
export const VALIDADE_MS = 6 * 60 * 60 * 1000

const CHAVE = 'copyhaunt-config'

/**
 * O que este módulo precisa do mundo, injetado para poder ser testado sem
 * rede e sem `chrome`. É o mesmo padrão do relógio em `src/core/clock.ts` e do
 * alvo do patch em `src/interceptor/xhr-patch.ts`.
 */
export interface Dependencias {
  buscar: typeof fetch
  ler: (chave: string) => Promise<unknown>
  gravar: (chave: string, valor: unknown) => Promise<void>
  agora: () => number
}

interface Guardado {
  em: number
  config: unknown
}

/**
 * Devolve a config, preferindo o cache válido, depois a rede, depois a cópia
 * embutida.
 *
 * Nunca lança: uma config indisponível não pode derrubar a extensão. O pior
 * caso é a extensão trabalhar com os valores que vieram no pacote — que é
 * exatamente como ela trabalharia sem este módulo.
 */
export async function obterConfig(deps: Dependencias): Promise<ConfigRemota> {
  const guardado = (await deps.ler(CHAVE).catch(() => undefined)) as
    | Guardado
    | undefined

  if (guardado && deps.agora() - guardado.em < VALIDADE_MS) {
    const doCache = validarConfig(guardado.config)
    // Cache que não passa mais na validação é lixo: segue para a rede.
    if (doCache) return doCache
  }

  try {
    const resposta = await deps.buscar(URL_CONFIG)
    if (!resposta.ok) return CONFIG_EMBUTIDA

    const config = validarConfig(await resposta.json())
    if (!config) return CONFIG_EMBUTIDA

    await deps.gravar(CHAVE, { em: deps.agora(), config })
    return config
  } catch {
    // Sem rede, DNS caído, JSON quebrado: a extensão continua com o pacote.
    return CONFIG_EMBUTIDA
  }
}
