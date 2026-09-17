const PREFIXO_ANTI_SEQUESTRO = /^\s*for\s*\(\s*;\s*;\s*\)\s*;/

export function extrairObjetosJson(corpo: string): unknown[] {
  const normalizado = corpo.replace(PREFIXO_ANTI_SEQUESTRO, '').trim()
  if (!normalizado) return []

  try {
    return [JSON.parse(normalizado) as unknown]
  } catch {
    const objetos: unknown[] = []
    for (const linha of normalizado.split(/\r?\n/)) {
      const trecho = linha.trim()
      if (!trecho) continue
      try {
        objetos.push(JSON.parse(trecho) as unknown)
      } catch {
        // Respostas deferred podem conter trechos incompletos; ignorá-los é seguro.
      }
    }
    return objetos
  }
}
