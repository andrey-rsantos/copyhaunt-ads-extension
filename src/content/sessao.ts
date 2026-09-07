/**
 * O token público da página, lido do HTML.
 *
 * O `lsd` é o token anti-CSRF que a Biblioteca usa em toda requisição, e
 * existe **com ou sem login** — foi medido num perfil deslogado. É ele que
 * torna possível consultar o Instagram do anunciante sem a conta do usuário.
 *
 * Não confundir com o `token_de_sessao`, que esta extensão usava até 2026-09-07: esse
 * era vinculado à sessão, e é justamente o que se quis parar de mandar.
 */

/**
 * Os dois lugares onde o token aparece, na ordem em que valem a pena.
 *
 * O primeiro é a forma corrente. O segundo é o campo escondido dos
 * formulários, mantido porque custa uma linha.
 *
 * Os `\s*` existem porque o HTML vem minificado hoje, mas isso é escolha
 * deles, não contrato.
 */
const PADROES = [
  /"LSD"\s*,\s*\[\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/,
  /name="lsd"\s+value="([^"]+)"/,
]

/**
 * Devolve o token, ou `null`.
 *
 * `null` significa que a página não é o que esperávamos — quem chama trata
 * como "não dá para perguntar".
 */
export function extrairLsd(html: string): string | null {
  for (const padrao of PADROES) {
    const achado = html.match(padrao)?.[1]
    if (achado) return achado
  }
  return null
}
