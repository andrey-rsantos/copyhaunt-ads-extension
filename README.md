# CopyHaunt Ads

Extensão de navegador Chrome MV3 para transformar a Biblioteca de Anúncios da
Meta em uma ferramenta de *ad intelligence*.

O CopyHaunt ajuda gestores de tráfego e infoprodutores a encontrar criativos, comparar ofertas e organizar sinais de escala durante uma pesquisa. É gratuito, disponibilizado publicamente e inspirado por referências públicas de mercado, com desenho próprio e sem reaproveitamento de código de terceiros.

## O que ele faz

- Intercepta e normaliza os dados que a Biblioteca de Anúncios já carrega na
  página.
- Exibe uma bandeja de ações diretamente nos cards de anúncios.
- Filtra anúncios por período de veiculação e destaca sinais úteis para a
  pesquisa.
- Minera resultados com rolagem automática, deduplicação e acompanhamento de
  progresso.
- Baixa criativos de imagem e vídeo quando a mídia está disponível em qualidade
  compatível.
- Abre links do anunciante, incluindo o fluxo de consulta de Instagram quando
  iniciado por ação explícita do usuário.
- Mantém resultados e configurações locais sem depender de um backend próprio.

## Como funciona

1. O interceptador observa as respostas que a Biblioteca de Anúncios já
   solicita durante a navegação.
2. O conteúdo é normalizado para um formato interno de anúncio, sem espalhar o
   formato da Meta pelo restante da extensão.
3. O painel aplica filtros, ancora ações nos cards e permite continuar a
   pesquisa sem uma segunda interface de mineração.

A mineração permanece passiva: ela não dispara requisições próprias à Meta. A
consulta de Instagram é uma exceção deliberada, limitada a um clique explícito,
a um anunciante por sessão e sem enviar cookies da conta do usuário.

## Instalação local

Pré-requisitos: Node.js e Google Chrome.

```bash
git clone https://github.com/andrey-rsantos/copyhaunt-ads-extension.git
cd copyhaunt-ads-extension
npm ci
npm run build
```

Depois:

1. Abra `chrome://extensions`.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `dist/` gerada pelo build.
5. Abra a Biblioteca de Anúncios da Meta.

## Desenvolvimento

```bash
npm test
npm run typecheck
npm run verify:build
npm run e2e
```

O build é uma extensão MV3 completa. O verificador confere o manifest gerado,
as permissões e a preservação do interceptador no `MAIN world`.

## Stack e validação

- TypeScript, React e Chrome MV3
- Vite com CRXJS para o build da extensão
- Vitest para testes unitários e de integração
- Playwright para testes end-to-end e validação no Chrome
- Chrome DevTools para diagnóstico e validações manuais de performance

## Privacidade e permissões

- A extensão usa a permissão `storage` para preferências, cache e resultados
  locais.
- Não possui backend próprio nem autenticação da extensão.
- A configuração operacional remota é um JSON estático; ela nunca é executada
  como código.
- A mineração não cria tráfego adicional para a Meta.
- A consulta opcional de Instagram é disparada somente por ação explícita e não
  envia cookies da conta do usuário.

Leia a [política de privacidade](PRIVACY.md) para saber quais dados são
processados, onde ficam armazenados e quais requisições saem do navegador.

## Referências e processo

O [Copycat Ads](https://chromewebstore.google.com/detail/copycat-ads-adspy-for-ad/hmdinepahgmfhgojoglndlhllogdceli)
foi a principal referência de produto para a concepção do CopyHaunt. Este
projeto é uma implementação independente, com código e decisões próprias, e
não é afiliado ao Copycat Ads.

Este projeto usa diretamente o [Superpowers, de obra](https://github.com/obra/superpowers) em todo o fluxo de desenvolvimento. Specs, planos de execução, testes, execução incremental e checkpoints seguem o framework.

## Contribuindo

Antes de abrir uma contribuição:

1. leia `AGENTS.md`;
2. rode a suíte de testes e o typecheck;
3. mantenha o escopo da mudança explícito;
4. descreva no pull request o comportamento alterado e como ele foi verificado.

Discussões sobre mudanças de arquitetura devem ser registradas em `docs/superpowers/specs/`, e planos de execução ficam em `docs/superpowers/plans/`.

## Licença

A licença open source será adicionada antes da publicação da primeira release.
