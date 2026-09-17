import { existsSync, readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'))
const falhas = []

if (manifest.action?.default_title !== 'Abrir resultados') {
  falhas.push('action.default_title deveria ser "Abrir resultados"')
}

if (!existsSync('dist/src/resultados/index.html')) {
  falhas.push('dist/src/resultados/index.html não foi gerado')
}

const scripts = manifest.content_scripts ?? []
const main = scripts.find((s) => s.world === 'MAIN')

if (!main) {
  falhas.push(
    'nenhum content script com world MAIN no manifest gerado — ' +
      'o CRXJS descartou o campo durante o build',
  )
} else if (main.run_at !== 'document_start') {
  falhas.push(`o script do main world tem run_at "${main.run_at}"`)
}

if (scripts.length !== 2) {
  falhas.push(`esperados 2 content scripts, encontrados ${scripts.length}`)
}

const permissoes = manifest.permissions ?? []
if (permissoes.length !== 1 || permissoes[0] !== 'storage') {
  falhas.push(`permissions deveria ser ["storage"], é ${JSON.stringify(permissoes)}`)
}

const hosts = manifest.host_permissions ?? []
const esperados = [
  '*://*.facebook.com/ads/library/*',
  'https://raw.githubusercontent.com/andrey-rsantos/CopyHaunt-Ads/*',
]
if (hosts.length !== esperados.length || hosts.some((h, i) => h !== esperados[i])) {
  falhas.push(`host_permissions inesperado: ${JSON.stringify(hosts)}`)
}

if (falhas.length > 0) {
  console.error('\nmanifest gerado não passou na verificação:\n')
  for (const f of falhas) console.error('  - ' + f)
  console.error('')
  process.exit(1)
}

console.log('manifest gerado OK: world MAIN preservado, permissões mínimas')
