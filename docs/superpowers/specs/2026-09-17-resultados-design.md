# Tela de resultados da mineração — Design

**Spec de origem:** `docs/superpowers/specs/2026-09-10-bloco-b-integracao-design.md`,
seção 8.

**Decisão:** adiantar a tela de resultados antes do teste manual da Biblioteca.
O teste manual continua sendo obrigatório para fechar o Bloco B, mas não é
pré-requisito para construir e testar esta fatia localmente.

## 1. Objetivo

Depois que uma mineração terminar, os anúncios aprovados ficam disponíveis em
uma página própria da extensão. A página permite revisar os anúncios, ordenar
por sinais já normalizados e usar as ações que não dependem da grade da Meta.

O resultado substitui a sessão anterior quando uma nova mineração termina.
Fechar a página não apaga o resultado: o ícone da extensão a reabre.

## 2. Escopo da primeira entrega

Entrega:

- persistir os aprovados finais em `chrome.storage.local`;
- serializar e hidratar `Date` sem depender da serialização implícita do Chrome;
- abrir a página por um atalho no cartão de progresso;
- reabrir a mesma página pelo ícone da extensão;
- mostrar estado vazio quando ainda não há mineração concluída;
- renderizar cards com preview, anunciante, texto, tempo ativo e plataformas;
- ordenar por maior tempo ativo, mais criativos repetidos e mais anúncios do
  anunciante;
- reutilizar links, cópia e download já existentes quando o dado estiver
  disponível.

Fora desta entrega:

- iniciar automaticamente a página ao fim da mineração;
- guardar histórico de várias sessões;
- sincronizar resultados entre perfis ou dispositivos;
- fazer a consulta de Instagram a partir da página de resultados;
- pedir nova permissão do manifest.

## 3. Decisão sobre Instagram

A consulta de Instagram continua na Biblioteca. O algoritmo atual precisa do
HTML da página da Meta para extrair o `lsd`; a página de resultados é uma página
da extensão e não possui esse contexto.

Na tela de resultados:

- um Instagram já conhecido é exibido como link;
- um Instagram desconhecido não dispara consulta automática nem apresenta um
  botão que fabrique uma requisição fora da Biblioteca;
- a ação de Instagram continua disponível na bandeja da Biblioteca, onde a
  regra de clique explícito e o cache em memória já existem.

Essa decisão preserva o desenho de rede do spec e evita introduzir uma ponte
entre a página de resultados, o service worker e uma aba da Meta.

## 4. Arquitetura

### 4.1 Modelo persistido

O armazenamento usa uma chave única e versionada:

```ts
const CHAVE_RESULTADO = 'copyhaunt:resultado:v1'

interface ResultadoPersistidoV1 {
  versao: 1
  salvoEm: string
  origem: string
  estado: EstadoMineracao
  anuncios: AdPersistido[]
}
```

`AdPersistido` tem a mesma forma de `Ad`, mas `iniciouEm` é uma string ISO.
O codec rejeita versão desconhecida, datas inválidas e itens que não tenham os
campos mínimos do tipo `Ad`; uma carga inválida vira resultado vazio e não
derruba a página.

O módulo puro de resultados também reconstrói um `AdStore` a partir dos
anúncios hidratados. Assim, `presenca` e `colacaoDe` continuam sendo derivados
da mesma regra usada durante a mineração, sem duplicar contadores no storage.

### 4.2 Fluxo de escrita

No fim de `dispararMineracao`, depois que o pós-filtro opcional de Instagram
terminar:

1. obter os anúncios finais;
2. salvar o snapshot com a URL da busca e o estado terminal;
3. atualizar o cartão de progresso para oferecer `Ver resultados`;
4. manter o log atual no console.

Uma mineração pausada não grava resultado novo. Falha de `chrome.storage.local`
é registrada no console e não altera o estado visual da Biblioteca.

### 4.3 Página da extensão

Criar uma entrada `src/resultados/index.html` e uma aplicação React em
`src/resultados/`. A página carrega o snapshot uma vez ao montar, hidrata os
anúncios e mantém a ordenação apenas em estado local.

O layout usa os tokens existentes em `src/styles/tokens.css` e segue o IDV:

- fundo escuro e superfície em carvão;
- cabeçalho com quantidade de aprovados, origem e data da mineração;
- seletor de ordenação;
- grade responsiva de cards;
- estado vazio com explicação e atalho para abrir a Biblioteca;
- estado de resultado corrompido tratado como vazio, com mensagem de
  diagnóstico não técnico.

Cada card mostra o primeiro criativo disponível, nome do anunciante, dias
ativos, colação, presença do anunciante na busca, texto principal/título e
plataformas. Os controles reutilizam as funções puras existentes para links e
cópia; o download usa o mesmo `baixarCriativos` com um adaptador de salvamento
da página.

### 4.4 Abertura da página

O manifest ganha apenas:

```ts
action: { default_title: 'Abrir resultados' }
```

O service worker reage a `chrome.action.onClicked` e abre a URL da página de
resultados com `chrome.runtime.getURL`. O cartão de progresso usa a mesma URL
em uma ação iniciada por clique do usuário. Nenhuma permissão nova é
necessária.

## 5. Contratos e fronteiras

- `src/core/resultados.ts`: tipos persistidos, codec, hidratação e ordenação;
  não importa `chrome`, DOM ou React.
- `src/content/index.ts`: único produtor do snapshot; salva somente após o
  estado terminal e o pós-filtro.
- `src/resultados/`: único consumidor visual do snapshot; não conhece o DOM da
  Meta.
- `src/background/index.ts`: única abertura da página pelo ícone.
- `src/manifest.config.ts` e `vite.config.ts`: registram a ação e a entrada de
  build, mantendo `permissions: ['storage']`.

## 6. Ordenação

As opções são estáveis e descendentes:

| Opção | Chave |
|---|---|
| Tempo ativo | `diasAtivos(ad.iniciouEm, agora)` |
| Criativos repetidos | `store.colacaoDe(ad)` |
| Anúncios do anunciante | `store.presenca(ad.anunciante.pageId)` |

Empates preservam a ordem em que os anúncios chegaram ao resultado. A data de
referência da ordenação é capturada ao carregar a página, para que a lista não
reordene sozinha enquanto o usuário a lê.

## 7. Verificação

Antes da implementação, cada comportamento terá teste unitário falhando:

- codec preserva `Date`, campos opcionais e mídias;
- payload inválido não atravessa o codec;
- as três ordenações usam as métricas corretas e preservam empates;
- escrita ocorre somente em estado terminal e depois do pós-filtro;
- manifest registra `action` sem ampliar permissões;
- página mostra estado vazio, snapshot válido e cards ordenáveis;
- abertura pelo cartão e pelo ícone aponta para a mesma página.

Verificação final:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
```

Não executar `npm.cmd run gravar:fixtures`.
