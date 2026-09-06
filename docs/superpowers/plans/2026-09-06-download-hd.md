# Download em HD: o terceiro botão da bandeja · Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Sem essas skills carregadas, siga `AGENTS.md`, seção "O plano é o estado":
> o comportamento exigido é o mesmo e não depende de harness.

## Progresso

- **Estado:** não iniciado
- **Última tarefa concluída:** —
- **Próxima tarefa:** Task 1
- **Notas de retomada:** —

**Goal:** Dar ação ao botão `⤓`, baixando os criativos do anúncio na melhor
qualidade que a Meta serve — arquivo solto quando é um só, ZIP quando o anúncio
traz vários.

**Architecture:** O normalizador já entrega `midias[].alta` como
`video_hd_url` ou `original_image_url`, então não há nada a extrair: só buscar.
O fbcdn responde a `fetch` cross-origin de qualquer contexto (Spike 1), e o
download roda no content script, que por estar em mundo isolado não sofre a CSP
da página. Salvar é blob mais âncora com `download`, o que dispensa a permissão
`downloads`.

**Tech Stack:** TypeScript 7, Vitest 5 com jsdom, Playwright 1.63, JSZip 3.10.1.

**Spec:** `docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md`
(seção 7, "A5 · Download em HD"; seção 4, Spike 1; seção 11, Stack)

## Por que isto existe

É o último dos três botões da bandeja sem ação. Copiar e OPEN já funcionam;
`⤓` ainda cai no comentário `'baixar' ainda não tem ação. Ciclo próprio.` em
`src/content/tray.ts`. Este é o ciclo.

## O que o Spike 1 já resolveu, e o que isso dispensa

Medido: o fbcdn responde `Access-Control-Allow-Origin: *` para origem de
extensão, para origem estranha e para requisição sem `Origin`. Consequências,
todas já registradas no spec:

- **dispensa `host_permissions` no fbcdn** — um `fetch` comum basta;
- **dispensa a permissão `downloads`** — blob mais âncora com `download` salva
  sem ela, e é permissão que pesa na revisão da Web Store;
- **dispensa regra de DNR e a permissão `declarativeNetRequest`.**

Se alguma tarefa parecer precisar de qualquer uma dessas coisas, **pare**: o
desenho está errado.

## A única dependência nova, e por que ela entra

`jszip@3.10.1`, fixada sem `^`, como o resto do `package.json` deste projeto.
Entra em `dependencies`, não em `devDependencies`: ela viaja no pacote da
extensão.

Está prevista na seção 11 do spec ("Empacotamento de mídia | JSZip"), e é a
única coisa aqui que não dá para fazer com o que já existe: escrever o
container ZIP à mão é CRC32 mais dois cabeçalhos binários, código que ninguém
quer depurar às três da manhã. `CompressionStream`, que é nativo, faz gzip e
deflate — não faz o container.

## Global Constraints

- **`permissions` continua exatamente `["storage"]`.** Nenhuma permissão nova,
  em especial não `downloads`.
- **`host_permissions` não muda.** Continua com os dois hosts que já tem.
- **Nenhuma dependência além de `jszip@3.10.1`.**
- **O verificador do build continua travando nos dois hosts e em `["storage"]`.**
  `npm.cmd run verify:build` deve seguir imprimindo
  `manifest gerado OK: world MAIN preservado, permissões mínimas`.
- **Nada de espera por tempo fixo em teste.** Use `vi.waitFor`, `expect.poll` ou
  o auto-waiting do Playwright. Espera chutada passa isolada e quebra na suíte.
- **npm no PowerShell do Windows:** usar `npm.cmd` e `npx.cmd`.
- **Nunca rodar `npm.cmd run gravar:fixtures`.**
- **Quem commita é o revisor.** O executor escreve `.commit-msg-codex` e para.
- **Commits:** padrão de `AGENTS.md`, tipo em inglês, texto em pt-BR.
- **Ao fechar cada Task:** rodar a verificação dela, marcar os `- [x]` e
  atualizar o bloco **Progresso** no topo deste arquivo. Plano desatualizado é
  trabalho perdido na próxima sessão.

---

## Task 1: Como os arquivos se chamam

**Files:**
- Create: `src/core/baixar.ts`
- Create: `tests/baixar.test.ts`

**Interfaces:**
- Produces: de `src/core/baixar.ts` —
  `nomeDoArquivo(ad: Ad, midia: Midia): string`,
  `nomeNoPacote(indice: number, midia: Midia): string`,
  `nomeDoPacote(ad: Ad): string`.

Módulo puro, sem DOM e sem rede: o nome do arquivo é a parte que o usuário vê
todo dia na pasta de downloads, e é a que mais vale testar sem navegador.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/baixar.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { nomeDoArquivo, nomeDoPacote, nomeNoPacote } from '../src/core/baixar'
import type { Ad, Midia } from '../src/core/types'

function ad(extra: Partial<Ad> = {}): Ad {
  return {
    id: '652131454176487',
    iniciouEm: new Date('2026-08-01T00:00:00Z'),
    colacao: 1,
    anunciante: { pageId: '378128628724966', pageName: 'Renan Botelho Dr' },
    midias: [],
    plataformas: [],
    ativo: true,
    ...extra,
  }
}

function video(alta: string): Midia {
  return { formato: 'video', alta, baixa: alta }
}

function imagem(alta: string): Midia {
  return { formato: 'imagem', alta, baixa: alta }
}

const MP4 = 'https://video.fbcdn.net/v/t42.1790-2/abc.mp4?_nc_cat=1&oh=00_x'
const JPG = 'https://scontent.fbcdn.net/v/t45.1600-4/def.jpg?stp=dst-jpg&oe=1'

describe('nomeDoArquivo', () => {
  it('junta o anunciante ao ID do anúncio, com a extensão da mídia', () => {
    expect(nomeDoArquivo(ad(), video(MP4))).toBe(
      'renan-botelho-dr-652131454176487.mp4',
    )
  })

  it('lê a extensão antes da query, não o fim da URL', () => {
    // A URL do fbcdn termina em parâmetros, e o nome do arquivo não pode
    // herdar nada deles.
    expect(nomeDoArquivo(ad(), imagem(JPG))).toBe(
      'renan-botelho-dr-652131454176487.jpg',
    )
  })

  it('normaliza jpeg para jpg, que é o mesmo arquivo com dois nomes', () => {
    expect(nomeDoArquivo(ad(), imagem('https://x.fbcdn.net/a.JPEG'))).toBe(
      'renan-botelho-dr-652131454176487.jpg',
    )
  })

  it.each([
    ['vídeo', video('https://video.fbcdn.net/v/sem-extensao'), 'mp4'],
    ['imagem', imagem('https://scontent.fbcdn.net/v/sem-extensao'), 'jpg'],
  ])('cai no formato quando a URL de %s não traz extensão', (_c, midia, ext) => {
    expect(nomeDoArquivo(ad(), midia)).toBe(
      `renan-botelho-dr-652131454176487.${ext}`,
    )
  })

  it('tira acento e pontuação do nome do anunciante', () => {
    const a = ad({
      anunciante: { pageId: '1', pageName: 'Ação & Cia. Ltda — Oficial!' },
    })
    expect(nomeDoArquivo(a, video(MP4))).toBe('acao-cia-ltda-oficial-1.mp4')
  })

  it('não deixa o nome crescer sem limite', () => {
    const a = ad({ anunciante: { pageId: '1', pageName: 'a'.repeat(200) } })
    const nome = nomeDoArquivo(a, video(MP4))
    expect(nome.length).toBeLessThanOrEqual(60)
    expect(nome.endsWith('-1.mp4')).toBe(true)
  })

  it('usa só o ID quando não sobra nada do nome do anunciante', () => {
    const a = ad({ anunciante: { pageId: '1', pageName: '🔥🔥🔥' } })
    expect(nomeDoArquivo(a, video(MP4))).toBe('652131454176487.mp4')
  })

  it('não deixa o nome terminar em hífen depois do corte', () => {
    const a = ad({
      anunciante: { pageId: '1', pageName: `${'a'.repeat(39)} b c` },
    })
    expect(nomeDoArquivo(a, video(MP4))).not.toContain('--')
    expect(nomeDoArquivo(a, video(MP4))).toMatch(/^[a-z0-9-]+\.mp4$/)
  })
})

describe('nomeNoPacote', () => {
  it('numera a partir de 1, com dois dígitos para ordenar direito', () => {
    // Sem o zero à esquerda, 10 viria antes de 2 na pasta do usuário.
    expect(nomeNoPacote(0, video(MP4))).toBe('01.mp4')
    expect(nomeNoPacote(9, imagem(JPG))).toBe('10.jpg')
  })

  it('não repete o nome do anunciante, que já está no nome do ZIP', () => {
    expect(nomeNoPacote(0, video(MP4))).not.toContain('renan')
  })
})

describe('nomeDoPacote', () => {
  it('é o mesmo nome base, com extensão zip', () => {
    expect(nomeDoPacote(ad())).toBe('renan-botelho-dr-652131454176487.zip')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/baixar.test.ts
```

Esperado: FALHA, módulo `../src/core/baixar` não encontrado.

- [ ] **Step 3: Escrever os nomes**

Criar `src/core/baixar.ts`:

```ts
import type { Ad, Midia } from './types'

/**
 * Como os criativos baixados se chamam.
 *
 * Módulo puro: nem DOM nem rede. O nome do arquivo é o que o usuário vê todo
 * dia na pasta de downloads, e é a parte que mais vale testar sem navegador.
 */

/**
 * As extensões que o fbcdn serve.
 *
 * O `(?=$|[?#])` existe porque a URL termina em parâmetros — `?_nc_cat=1&oh=…`
 * —, e sem ele o nome do arquivo herdaria metade da query.
 */
const EXTENSAO = /\.(mp4|mov|webm|jpe?g|png|webp|gif)(?=$|[?#])/i

/** Quantos caracteres do nome do anunciante cabem antes de virar ruído. */
const LIMITE_APELIDO = 40

function extensaoDe(midia: Midia): string {
  const achada = midia.alta.match(EXTENSAO)?.[1].toLowerCase()
  if (achada) return achada === 'jpeg' ? 'jpg' : achada
  // O fbcdn às vezes serve por caminho sem extensão. O formato já é conhecido,
  // e um palpite certo em 99% dos casos vale mais que um arquivo sem extensão
  // que o sistema não sabe abrir.
  return midia.formato === 'video' ? 'mp4' : 'jpg'
}

/**
 * O nome do anunciante reduzido ao que sobrevive a um sistema de arquivos.
 *
 * Acento vira letra simples, o resto vira hífen. Pode sobrar string vazia — um
 * nome só de emoji não deixa nada —, e quem chama trata esse caso.
 */
function apelido(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, LIMITE_APELIDO)
    .replace(/^-+|-+$/g, '')
}

/**
 * O nome sem extensão: anunciante mais ID do anúncio.
 *
 * O ID entra sempre porque é o que torna o nome único; o anunciante entra
 * porque, com trinta criativos na pasta, o ID sozinho não diz nada.
 */
function nomeBase(ad: Ad): string {
  const quem = apelido(ad.anunciante.pageName)
  return quem ? `${quem}-${ad.id}` : ad.id
}

/** O nome do arquivo quando o anúncio traz uma mídia só. */
export function nomeDoArquivo(ad: Ad, midia: Midia): string {
  return `${nomeBase(ad)}.${extensaoDe(midia)}`
}

/**
 * O nome de cada mídia dentro do ZIP.
 *
 * Só o número: o anunciante e o anúncio já estão no nome do pacote, e repetir
 * os dois em cada entrada seria ruído dentro de uma pasta que já os carrega.
 * O zero à esquerda é o que faz `10` vir depois de `2` na listagem.
 */
export function nomeNoPacote(indice: number, midia: Midia): string {
  return `${String(indice + 1).padStart(2, '0')}.${extensaoDe(midia)}`
}

/** O nome do ZIP quando o anúncio traz mais de uma mídia. */
export function nomeDoPacote(ad: Ad): string {
  return `${nomeBase(ad)}.zip`
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/baixar.test.ts
npm.cmd test
npm.cmd run typecheck
```

Esperado: PASSA.

---

## Task 2: Buscar as mídias e entregar o arquivo

**Files:**
- Modify: `package.json`
- Create: `src/content/download.ts`
- Create: `tests/download.test.ts`

**Interfaces:**
- Consumes: `nomeDoArquivo`, `nomeNoPacote`, `nomeDoPacote` (Task 1).
- Produces: de `src/content/download.ts` —
  `Dependencias { buscar: typeof fetch; salvar: (blob: Blob, nome: string) => void }`,
  `baixarCriativos(ad: Ad, deps: Dependencias): Promise<void>`.

- [ ] **Step 1: Instalar o JSZip**

```bash
npm.cmd install jszip@3.10.1 --save-exact
```

Confirme que ele entrou em `dependencies` — não em `devDependencies` — e que
a versão ficou `"jszip": "3.10.1"`, sem `^`, como as demais deste projeto.
**Nenhum outro pacote deve entrar.** Se o `npm.cmd` trouxer mais alguma coisa
para `dependencies`, pare e relate.

O JSZip traz os próprios tipos, então **não instale `@types/jszip`**.

- [ ] **Step 2: Escrever o teste que falha**

Criar `tests/download.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { baixarCriativos, type Dependencias } from '../src/content/download'
import type { Ad, Midia } from '../src/core/types'

const MP4 = 'https://video.fbcdn.net/v/t42.1790-2/abc.mp4?_nc_cat=1'
const JPG = 'https://scontent.fbcdn.net/v/t45.1600-4/def.jpg?stp=dst-jpg'

function video(alta = MP4): Midia {
  return { formato: 'video', alta, baixa: alta }
}

function imagem(alta = JPG): Midia {
  return { formato: 'imagem', alta, baixa: alta }
}

function ad(midias: Midia[]): Ad {
  return {
    id: '652131454176487',
    iniciouEm: new Date('2026-08-01T00:00:00Z'),
    colacao: 1,
    anunciante: { pageId: '378128628724966', pageName: 'Renan Botelho Dr' },
    midias,
    plataformas: [],
    ativo: true,
  }
}

function corpo(texto: string, ok = true) {
  return { ok, blob: async () => new Blob([texto]) } as unknown as Response
}

function deps(extra: Partial<Dependencias> = {}): Dependencias {
  return {
    buscar: vi.fn(async () => corpo('conteúdo')),
    salvar: vi.fn(),
    ...extra,
  }
}

describe('uma mídia só', () => {
  it('salva o arquivo solto, sem empacotar nada', async () => {
    const d = deps()
    await baixarCriativos(ad([video()]), d)

    expect(d.salvar).toHaveBeenCalledTimes(1)
    const [blob, nome] = (d.salvar as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(nome).toBe('renan-botelho-dr-652131454176487.mp4')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('busca a versão alta, nunca a de pré-visualização', async () => {
    const d = deps()
    await baixarCriativos(
      ad([{ formato: 'video', alta: MP4, baixa: 'https://x/ruim.mp4' }]),
      d,
    )
    expect(d.buscar).toHaveBeenCalledWith(MP4)
  })
})

describe('várias mídias', () => {
  it('empacota tudo num ZIP com o nome do anúncio', async () => {
    const d = deps()
    await baixarCriativos(ad([video(), imagem()]), d)

    expect(d.salvar).toHaveBeenCalledTimes(1)
    const [blob, nome] = (d.salvar as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(nome).toBe('renan-botelho-dr-652131454176487.zip')
    expect((blob as Blob).size).toBeGreaterThan(0)
  })

  it('o ZIP guarda uma entrada por mídia, numeradas', async () => {
    const d = deps()
    await baixarCriativos(ad([video(), imagem()]), d)

    const [blob] = (d.salvar as ReturnType<typeof vi.fn>).mock.calls[0]
    // Os nomes das entradas viajam em claro no cabeçalho do ZIP, porque
    // mídia entra sem compressão.
    const bytes = new Uint8Array(await (blob as Blob).arrayBuffer())
    const texto = new TextDecoder().decode(bytes)
    expect(texto).toContain('01.mp4')
    expect(texto).toContain('02.jpg')
  })

  it('busca todas as mídias', async () => {
    const d = deps()
    await baixarCriativos(ad([video(), imagem()]), d)
    expect(d.buscar).toHaveBeenCalledTimes(2)
  })
})

describe('quando alguma mídia falha', () => {
  it('entrega as que vieram, em vez de desistir de todas', async () => {
    const buscar = vi.fn(async (url: string) =>
      url === MP4 ? corpo('bom') : corpo('ruim', false),
    ) as unknown as typeof fetch
    const d = deps({ buscar })

    await baixarCriativos(ad([video(), imagem()]), d)

    // Sobrou uma: vai solta, não faz sentido um ZIP de um arquivo.
    const [, nome] = (d.salvar as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(nome).toBe('renan-botelho-dr-652131454176487.mp4')
  })

  it('não salva nada, e não lança, quando nenhuma vem', async () => {
    const d = deps({ buscar: vi.fn(async () => corpo('', false)) })
    await expect(baixarCriativos(ad([video(), imagem()]), d)).resolves
      .toBeUndefined()
    expect(d.salvar).not.toHaveBeenCalled()
  })

  it('não lança quando a rede cai', async () => {
    const d = deps({
      buscar: vi.fn(async () => {
        throw new Error('sem rede')
      }),
    })
    await expect(baixarCriativos(ad([video()]), d)).resolves.toBeUndefined()
    expect(d.salvar).not.toHaveBeenCalled()
  })

  it('não faz nada quando o anúncio não tem mídia', async () => {
    const d = deps()
    await baixarCriativos(ad([]), d)
    expect(d.buscar).not.toHaveBeenCalled()
    expect(d.salvar).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/download.test.ts
```

Esperado: FALHA, módulo `../src/content/download` não encontrado.

- [ ] **Step 4: Escrever o download**

Criar `src/content/download.ts`:

```ts
import JSZip from 'jszip'
import { nomeDoArquivo, nomeDoPacote, nomeNoPacote } from '../core/baixar'
import type { Ad, Midia } from '../core/types'

/**
 * Baixar os criativos do anúncio.
 *
 * Roda no content script, e é lá que precisa rodar: por estar em mundo
 * isolado, ele não sofre a CSP da página. E o fbcdn responde
 * `Access-Control-Allow-Origin: *` a qualquer origem (Spike 1, seção 4 do
 * spec), então um `fetch` comum basta — sem `host_permissions` no CDN, sem
 * regra de DNR, sem a permissão `downloads`.
 */

export interface Dependencias {
  buscar: typeof fetch
  /** Entrega o arquivo ao usuário. Injetado para testar sem navegador. */
  salvar: (blob: Blob, nome: string) => void
}

interface Baixada {
  midia: Midia
  blob: Blob
}

/**
 * Busca uma mídia. `null` quando ela não vem.
 *
 * Falha isolada por mídia de propósito: num carrossel de dez, uma URL expirada
 * não pode custar as outras nove.
 */
async function baixarUma(
  midia: Midia,
  deps: Dependencias,
): Promise<Blob | null> {
  try {
    const resposta = await deps.buscar(midia.alta)
    return resposta.ok ? await resposta.blob() : null
  } catch {
    return null
  }
}

/**
 * Baixa os criativos e entrega ao usuário: arquivo solto quando é um só, ZIP
 * quando são vários.
 *
 * Nunca lança. Não achou nada, não salva nada — o botão simplesmente não
 * produz arquivo, e isso é preferível a um erro na cara de quem só queria um
 * vídeo.
 */
export async function baixarCriativos(
  ad: Ad,
  deps: Dependencias,
): Promise<void> {
  if (ad.midias.length === 0) return

  const tentativas = await Promise.all(
    ad.midias.map(async (midia) => ({
      midia,
      blob: await baixarUma(midia, deps),
    })),
  )
  const boas = tentativas.filter((t): t is Baixada => t.blob !== null)

  if (boas.length === 0) return

  // Um arquivo só não vira ZIP: obrigar o usuário a descompactar um vídeo
  // seria cobrar um passo por nada.
  if (boas.length === 1) {
    deps.salvar(boas[0].blob, nomeDoArquivo(ad, boas[0].midia))
    return
  }

  const zip = new JSZip()
  boas.forEach(({ midia, blob }, i) => zip.file(nomeNoPacote(i, midia), blob))

  // Sem compressão, que é o padrão do JSZip: MP4 e JPEG já vêm comprimidos, e
  // passá-los pelo deflate custa tempo de CPU para não economizar byte nenhum.
  deps.salvar(await zip.generateAsync({ type: 'blob' }), nomeDoPacote(ad))
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/download.test.ts
npm.cmd test
npm.cmd run typecheck
```

Esperado: PASSA.

---

## Task 3: Ligar o botão `⤓`

**Files:**
- Modify: `src/content/tray.ts`
- Modify: `src/content/estilo.ts`
- Modify: `tests/tray-acoes.test.ts`

**Interfaces:**
- Consumes: `baixarCriativos` (Task 2).

- [ ] **Step 1: Trocar o teste do botão que não fazia nada**

Em `tests/tray-acoes.test.ts`, substituir o `describe('botão baixar', …)`
inteiro — aquele que hoje afirma que o botão "ainda não faz nada" — por:

```ts
describe('botão baixar', () => {
  const MP4 = 'https://video.fbcdn.net/v/t42.1790-2/abc.mp4?_nc_cat=1'

  function comMidia() {
    return ad({ midias: [{ formato: 'video', alta: MP4, baixa: MP4 }] })
  }

  it('busca a mídia em alta e entrega o arquivo ao usuário', async () => {
    const buscar = vi.fn(
      async () => ({ ok: true, blob: async () => new Blob(['x']) }) as unknown as Response,
    )
    vi.stubGlobal('fetch', buscar)

    // jsdom não implementa as URLs de objeto, então elas precisam existir
    // antes de serem espionadas. Só o `createObjectURL` interessa: se ele foi
    // chamado, o arquivo chegou à âncora, que é o que este teste verifica.
    // Não mocke o `click` do protótipo — ele mora em `HTMLElement`, e mockar
    // lá desativaria também o clique no próprio botão da bandeja.
    const criarUrl = vi.fn(() => 'blob:falso')
    URL.createObjectURL = criarUrl
    URL.revokeObjectURL = vi.fn()

    const shadow = plantar(comMidia())
    botao(shadow, 'baixar').click()

    await vi.waitFor(() => expect(criarUrl).toHaveBeenCalled())
    expect(buscar).toHaveBeenCalledWith(MP4)

    vi.unstubAllGlobals()
  })

  it('não abre menu nenhum: baixar é ação direta', () => {
    // Anúncio sem mídia de propósito: assim nada é requisitado, e o teste
    // mede só o que promete medir.
    const shadow = plantar()
    botao(shadow, 'baixar').click()
    expect(shadow.querySelector('.menu')).toBeNull()
  })

  it('não estoura no anúncio sem mídia', () => {
    const shadow = plantar()
    expect(() => botao(shadow, 'baixar').click()).not.toThrow()
  })

  it('ignora o segundo clique enquanto o primeiro não terminou', async () => {
    let liberar!: (r: Response) => void
    const buscar = vi.fn(() => new Promise<Response>((ok) => (liberar = ok)))
    vi.stubGlobal('fetch', buscar)

    const shadow = plantar(comMidia())
    const alvo = botao(shadow, 'baixar')
    alvo.click()
    await vi.waitFor(() => expect(alvo.dataset.ocupado).toBe('sim'))
    alvo.click()

    // Um carrossel demora, e sem trava o usuário impaciente baixaria tudo
    // duas vezes.
    expect(buscar).toHaveBeenCalledTimes(1)

    liberar({ ok: false } as Response)
    await vi.waitFor(() => expect(alvo.dataset.ocupado).toBeUndefined())
    vi.unstubAllGlobals()
  })
})
```

Note que este arquivo já importa `vi` e já define os utilitários `ad`,
`plantar` e `botao` no topo — use os que estão lá, não crie outros.

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/tray-acoes.test.ts
```

Esperado: FALHA — o botão `baixar` ainda não faz nada.

- [ ] **Step 3: Ligar o botão**

Em `src/content/tray.ts`, acrescentar aos imports:

```ts
import { baixarCriativos } from './download'
```

Acrescentar, logo **depois** da função `buscarEAbrirInstagram`:

```ts
/**
 * Entrega o arquivo ao usuário.
 *
 * Blob mais âncora com `download`, que é o que dispensa a permissão
 * `downloads` — permissão que pesaria na revisão da Web Store por nada.
 */
function salvarArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob)
  const ancora = document.createElement('a')
  ancora.href = url
  ancora.download = nome
  ancora.click()
  // Revogar no próximo tique: revogar na mesma volta do laço de eventos
  // chegaria antes de o navegador terminar de ler a URL.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Baixa os criativos do card, travando o botão enquanto isso.
 *
 * A trava não é enfeite: um carrossel demora, e sem sinal de que algo está
 * acontecendo o usuário clica de novo e baixa tudo duas vezes.
 */
async function baixarDoCard(botao: HTMLElement, ad: Ad): Promise<void> {
  if (botao.dataset.ocupado) return
  botao.dataset.ocupado = 'sim'
  try {
    await baixarCriativos(ad, {
      buscar: (...args) => fetch(...args),
      salvar: salvarArquivo,
    })
  } finally {
    delete botao.dataset.ocupado
  }
}
```

E, no listener de clique dos botões, substituir a linha

```ts
      // 'baixar' ainda não tem ação. Ciclo próprio.
```

pelo ramo do `baixar`. O encadeamento inteiro passa a ser:

```ts
      if (b.chave === 'baixar') {
        void baixarDoCard(botao, ad)
      } else if (b.chave === 'copiar') {
```

mantendo os ramos `copiar` e `abrir` exatamente como estão.

- [ ] **Step 4: Mostrar que o botão está ocupado**

Em `src/content/estilo.ts`, acrescentar logo **depois** da regra
`.botao:hover { filter: brightness(1.15); }`:

```css
  .botao[data-ocupado] {
    opacity: 0.55;
    cursor: progress;
  }
```

Sem cor nova: `tests/estilo.test.ts` reprova qualquer hexadecimal que não
conste do `CopyHaunt-IDV.md`, e aqui não é preciso nenhum.

- [ ] **Step 5: Rodar tudo**

```bash
npx.cmd vitest run tests/tray-acoes.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
```

Esperado: PASSA, tudo verde. Em especial, `tests/estilo.test.ts` e
`tests/instagram-menu.test.ts` continuam passando, e
`npm.cmd run verify:build` continua imprimindo
`manifest gerado OK: world MAIN preservado, permissões mínimas`.

- [ ] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg-codex` na raiz com:

```
✨ feat(overlay): dar ação ao botão baixar, com ZIP para o carrossel

O que foi feito:
- Baixar os criativos na melhor qualidade que a Meta serve
- Entregar arquivo solto quando é um só, ZIP quando o anúncio traz vários
- Travar o botão enquanto o download não termina

Como foi feito:
- Blob mais âncora com download, que dispensa a permissão downloads
- Um fetch comum basta: o Spike 1 mediu que o fbcdn responde
  Access-Control-Allow-Origin: * para qualquer origem
- Falha isolada por mídia: num carrossel de dez, uma URL expirada não custa
  as outras nove
- O ZIP entra sem compressão, que é o padrão do JSZip: MP4 e JPEG já vêm
  comprimidos, e passá-los pelo deflate gastaria CPU sem economizar byte

Considerações:
- Entra jszip@3.10.1, a única dependência nova, prevista na seção 11 do spec.
  Escrever o container ZIP à mão seria CRC32 e dois cabeçalhos binários;
  CompressionStream, que é nativo, faz deflate mas não faz o container
- permissions segue exatamente ["storage"] e host_permissions não mudou. Em
  especial, não entrou downloads, que pesa na revisão da Web Store
- O nome do arquivo leva o anunciante além do ID: com trinta criativos na
  pasta, o ID sozinho não diz nada
- Fecha o terceiro e último botão da bandeja

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Então **parar**. Quem commita é o revisor.

---

## Verificação final

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
git status --short
```

## O que este plano NÃO entrega

- **Download em lote**, de vários anúncios de uma vez. Pertence ao motor de
  mineração do Bloco B, não à bandeja de um card.
- **Barra de progresso.** A trava do botão já resolve o problema real, que era
  o clique repetido. Progresso de verdade exige ler o corpo em pedaços, e isso
  só vale a pena se alguém reclamar da espera.
