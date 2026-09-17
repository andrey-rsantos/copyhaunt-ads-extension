# Busca de Instagram na tela de resultados — Design

**Spec de origem:** `docs/superpowers/specs/2026-09-07-instagram-anonimo-design.md`,
`docs/superpowers/specs/2026-09-17-resultados-design.md` e decisão aprovada na
conversa de 2026-09-17.

## 1. Objetivo

Permitir que o usuário procure o Instagram de um anunciante diretamente no
menu colapsável `Links` da página de resultados, mantendo a consulta no
contexto da Biblioteca de Anúncios e somente após uma ação explícita.

O resultado encontrado deve ser persistido no snapshot para que o mesmo card
possa abrir `Instagram do anunciante` como link nas próximas visitas.

## 2. Decisões de produto

Quando `ad.anunciante.instagram` já existir, o item continua sendo um link
externo normal. Quando não existir, o item deixa de ser um botão desabilitado e
passa a oferecer `Buscar Instagram`.

Estados da ação:

| Estado | Texto/ação |
|---|---|
| desconhecido | `Buscar Instagram` clicável |
| em consulta | `Buscando Instagram…` desabilitado |
| encontrado | `Instagram do anunciante` como link |
| não encontrado | `Instagram não encontrado` desabilitado |
| falha | `Não foi possível buscar Instagram` desabilitado |

A consulta não ocorre ao abrir a página, ao abrir o menu, ao ordenar ou ao
renderizar cards. Ela só começa no clique explícito em `Buscar Instagram`.

Se dois cards da mesma página do anunciante forem acionados, a página de
resultados compartilha a mesma promessa por `pageId` e faz uma única consulta;
os cards relacionados recebem o mesmo resultado.

## 3. Arquitetura da ponte

O fluxo é:

```text
Resultados (clique)
  -> chrome.runtime.sendMessage({ tipo: 'buscar-instagram', pageId, origem })
  -> service worker valida origem e abre Biblioteca em aba inativa
  -> content script da Biblioteca aguarda a config e chama buscarInstagram()
  -> service worker devolve { url: string | null, erro?: string }
  -> Resultados atualiza UI e persiste o Instagram encontrado
```

O `service worker` é o único contexto que cria a aba da Biblioteca. A origem
deve ser validada antes de navegar: somente URLs HTTPS de
`facebook.com`/`www.facebook.com` no caminho da Biblioteca são aceitas. Uma
origem inválida retorna erro sem abrir aba.

O content script reaproveita `buscarInstagram` e suas travas de cache/em voo.
O listener espera a promessa de configuração usada por
`definirDocIdAnunciante`; se a config remota não habilitar o `doc_id`, a
consulta termina como ausência sem fabricar outro contrato.

O service worker precisa manter o canal de resposta aberto enquanto aguarda a
aba e a resposta do content script. A aba aberta pode permanecer disponível
para inspeção manual; não criar fechamento automático nem exigir a permissão
`tabs`.

## 4. Persistência e concorrência

Ao encontrar um perfil, a página atualiza todos os anúncios do snapshot com o
mesmo `anunciante.pageId`, preservando os demais campos, e grava novamente a
mesma chave `copyhaunt:resultado:v1`.

Adicionar ao adaptador de resultados uma operação testável de atualização por
`pageId`, com leitura, transformação e gravação sob uma fila local para evitar
que dois cliques sobrescrevam atualizações concorrentes. Se não houver
resultado salvo ou o snapshot mudar entre o clique e a resposta, não criar um
resultado novo: mostrar falha e manter o dado original.

Ausência de Instagram não grava uma URL falsa. A resposta `null` atualiza
somente o estado visual daquela sessão de resultados; a próxima visita pode
oferecer nova busca explícita, sem consulta automática.

## 5. Contrato de mensagens

As mensagens privadas de `chrome.runtime` devem ser discriminadas por
`tipo`:

```ts
type BuscarInstagramMensagem = {
  tipo: 'buscar-instagram'
  pageId: string
  origem: string
}

type RespostaInstagram =
  | { ok: true; url: string | null }
  | {
      ok: false
      motivo: 'origem-invalida' | 'aba-indisponivel' | 'conteudo-indisponivel'
    }
```

O service worker não aceita `pageId` vazio e não repassa HTML, tokens ou
respostas brutas para a página de resultados. O content script também não
aceita comandos vindos do `window.postMessage`; o comando passa pelo canal
privado da extensão.

## 6. UI do menu Links

`LinksMenu` continua usando `montarDestinos(ad)` como fonte dos seis destinos
e mantém a ordem atual. A única exceção de comportamento é o destino
`instagram` sem URL: ele renderiza o estado da busca e chama um callback
fornecido pelo `App`.

O menu segue colapsável, com um menu aberto por vez e fechamento ao clicar
fora. Durante a busca, a ação não fecha o menu automaticamente; isso deixa o
estado visível. Ao encontrar o perfil, o item vira link e pode ser aberto pelo
usuário em outro clique.

## 7. Fronteiras de código

- `src/content/instagram.ts`: manter a consulta existente e suas travas; não
  mover a chamada para React.
- `src/content/index.ts`: aguardar a config e responder ao comando recebido na
  aba da Biblioteca.
- `src/background/index.ts`: validar origem, abrir aba e intermediar mensagens;
  preservar a abertura existente de resultados e de configuração.
- `src/storage/resultados.ts`: atualização persistida do anunciante por
  `pageId`, com serialização existente.
- `src/resultados/App.tsx` e `src/resultados/LinksMenu.tsx`: estado por
  anunciante, deduplicação de promessas e atualização dos cards.
- `src/core/links.ts`: conservar rótulos, ordem e derivação sem introduzir
  requisição.

Nenhuma permissão nova, host novo ou `fetch` deve ser adicionado à página de
resultados. A única requisição continua sendo `buscarInstagram`, executada
pelo content script da Biblioteca após clique do usuário.

## 8. Verificação

Antes da implementação, testes unitários devem falhar para:

- item desconhecido oferecendo `Buscar Instagram` e não disparando nada ao
  renderizar;
- clique compartilhando consultas para o mesmo `pageId`;
- service worker rejeitando origem inválida;
- service worker abrindo a Biblioteca e repassando o comando ao content
  script;
- content script aguardando a config antes de chamar `buscarInstagram`;
- atualização persistida de todos os anúncios do anunciante sem perder campos;
- estados visuais de busca, ausência e link encontrado.

O E2E deve cobrir o contrato da página sem depender de rede da Meta: simular a
resposta do runtime e verificar a troca do item para link e a persistência no
storage. A integração real continua sendo validada manualmente na Biblioteca.

Verificação final:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
```

Não executar `npm.cmd run gravar:fixtures`.
