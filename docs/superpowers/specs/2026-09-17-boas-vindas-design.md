# Onboarding pós-instalação — Design

## Objetivo

Após uma instalação nova pela Chrome Web Store, abrir uma página interna de
boas-vindas da CopyHaunt Ads em uma nova aba ativa. A página apresenta o layout
aprovado em boas-vindas-preview.html e oferece uma ação principal para abrir a
Biblioteca de Anúncios da Meta.

## Experiência aprovada

A página usa uma composição editorial clean:

- fundo quase preto #08070D;
- logo CopyHaunt no canto superior esquerdo;
- indicação discreta “01 / first hunt” no canto superior direito;
- eyebrow “Ads intelligence for winning creatives”;
- headline grande “Pronto para caçar.”;
- selo roxo inclinado “Extensão instalada”;
- texto curto em português;
- CTA único “Abrir Biblioteca de Anúncios”;
- rodapé com “Biblioteca de Anúncios”, “CopyHaunt Ads” e
  “Observe · Capture · Modele”.

O preview atual é referência visual e deve ser migrado para arquivos da
extensão, sem criar uma segunda implementação visual divergente.

## Comportamento de instalação

O service worker já registra chrome.runtime.onInstalled e já usa
chrome.tabs.create para abrir páginas. O listener passará a:

1. manter o log de instalação;
2. abrir src/boas-vindas/index.html somente quando reason for install;
3. não abrir a página em update, chrome_update ou shared_module_update;
4. abrir a página como aba ativa;
5. manter inalterados o clique da action, que abre resultados, e a ponte de
   busca do Instagram.

Não haverá redirecionamento da aba existente: a instalação abre uma nova aba,
porque o evento ocorre no service worker e não depende de uma aba iniciadora.

## Navegação para a Meta

O CTA será um link comum para:

https://www.facebook.com/ads/library/

Ele abrirá a Biblioteca em nova aba com target="_blank" e rel="noreferrer". A
página de onboarding não fará fetch, não consultará storage e não exigirá
mensagem adicional ao service worker.

## Build e assets

Criar src/boas-vindas/index.html e
src/boas-vindas/boas-vindas.css. Adicionar a página aos inputs HTML do Vite.
Os assets existentes em logo/ serão referenciados por caminhos resolvíveis pelo
Vite e deverão aparecer no build final.

O URL final esperado será:

chrome-extension://<id>/src/boas-vindas/index.html

## Limites

- Não adicionar permissões a permissions ou host_permissions.
- Não alterar a action existente.
- Não abrir a página em atualizações.
- Não criar popup, options page, telemetria, fetch ou armazenamento para esta
  feature.
- Não manter a página de preview na raiz como segunda fonte de verdade depois
  que a implementação da extensão for validada.

## Verificação

- Testes unitários do service worker cobrem install, update e
  chrome_update.
- Teste E2E abre a página interna construída, confere o conteúdo visual
  essencial, os assets e o href exato do CTA.
- verify:build confirma que o build continua válido e sem permissões novas.
- Validação manual confirma que remover e instalar novamente a extensão abre
  uma única aba de onboarding, enquanto recarregar ou atualizar não abre outra.
