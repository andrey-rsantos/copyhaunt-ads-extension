/**
 * O token da sessão do Facebook, lido do HTML da própria página.
 *
 * Sem ele a consulta forjada não sai: medido num perfil descartável, sem
 * login o token não existe no HTML, e a consulta sem token responde 200 com
 * `data` vazio e 12 erros. Não há versão anônima deste caminho.
 */

/**
 * Os dois lugares onde o Facebook publica o token, na ordem em que valem a
 * pena ser tentados.
 *
 * O primeiro cobre as duas grafias que a Meta alterna, `DTSGInitData` e
 * `DTSGInitialData`, e é a forma corrente. O segundo é o campo escondido dos
 * formulários, mais antigo, mantido porque custa uma linha e cobre páginas
 * que a Meta ainda não migrou.
 *
 * Os `\s*` existem porque o HTML vem minificado hoje, mas isso é escolha
 * deles, não contrato.
 */
const PADROES = [
  /"DTSGInit(?:ial)?Data"\s*,\s*\[\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/,
  /name="token_de_sessao"\s+value="([^"]+)"/,
]

/**
 * Devolve o token, ou `null`.
 *
 * `null` não é erro: é o estado normal de quem não está logado, e quem chama
 * precisa tratá-lo como "não dá para perguntar", em silêncio.
 */
export function extrairTokenDeSessao(html: string): string | null {
  for (const padrao of PADROES) {
    const achado = html.match(padrao)?.[1]
    if (achado) return achado
  }
  return null
}
