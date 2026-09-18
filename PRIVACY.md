# Política de privacidade

Última atualização: 18 de setembro de 2026

O CopyHaunt Ads é uma extensão Chrome MV3 para pesquisa na Biblioteca de
Anúncios da Meta. Esta política descreve o tratamento de dados na versão
disponível neste repositório.

## Resumo

- Não existe backend próprio do CopyHaunt Ads.
- Não coletamos cadastro, senha, cookie, token de autenticação ou histórico de
  navegação para um servidor nosso.
- Resultados, preferências e cache ficam no armazenamento local do navegador.
- A extensão acessa a Biblioteca de Anúncios da Meta somente para oferecer a
  funcionalidade descrita na ficha da extensão.

## Dados processados

Durante o uso da Biblioteca de Anúncios, a extensão processa os dados que a
própria página carrega para exibir seus anúncios, como:

- ID do anúncio, anunciante, nome da página e links públicos;
- texto, título, chamada para ação, datas e plataformas;
- URLs públicas de imagens, vídeos e outros criativos;
- a URL da consulta da Biblioteca de Anúncios usada para abrir os resultados.

Esses dados são usados exclusivamente para normalizar os anúncios, aplicar os
filtros, minerar os resultados solicitados pelo usuário, exibir a página de
resultados e permitir o download de criativos escolhido pelo usuário.

## Armazenamento local

A extensão usa `chrome.storage.local` e o armazenamento local da página para
guardar preferências, o filtro de tempo ativo, o resultado da mineração, o
cache da configuração operacional e informações de Instagram encontradas para
os resultados. Esse armazenamento permanece no perfil local do navegador e não
é enviado para um servidor do CopyHaunt Ads.

O usuário pode remover esses dados pelas configurações do Chrome, limpando os
dados da extensão ou desinstalando-a.

## Requisições de rede

### Biblioteca de Anúncios da Meta

A mineração é passiva: a extensão observa e normaliza as respostas que a
Biblioteca de Anúncios já solicita durante a navegação. A extensão não cria uma
busca adicional para cada lote de anúncios.

### Consulta opcional de Instagram

Quando o usuário clica explicitamente em **Buscar Instagram**, a extensão faz
uma requisição específica à Meta para consultar o anunciante selecionado. Essa
requisição envia o ID público do anunciante e parâmetros técnicos da consulta,
mas usa `credentials: omit` e não envia os cookies da conta do usuário.

A consulta é limitada a um anunciante por sessão do navegador. O resultado é
armazenado localmente para evitar repetições desnecessárias.

### Configuração operacional

A extensão pode buscar um JSON estático público hospedado no repositório do
projeto. Esse arquivo contém apenas parâmetros operacionais, como padrões de
identificação, ritmo da mineração e o identificador técnico da consulta de
Instagram. O JSON nunca é executado como código e não recebe dados do usuário.

O arquivo é armazenado em cache local por até seis horas. Se a busca falhar ou
o conteúdo for inválido, a extensão usa a configuração embutida no pacote.

### Download de criativos

Quando o usuário escolhe baixar um criativo, a extensão busca a mídia na URL
pública fornecida pela Meta e entrega o arquivo ao navegador. O download não é
enviado para um servidor do CopyHaunt Ads.

## Compartilhamento de dados

O CopyHaunt Ads não mantém servidor próprio, não vende dados e não compartilha
os resultados da pesquisa com o desenvolvedor ou com terceiros. A Meta recebe
as requisições feitas à própria Biblioteca de Anúncios e, quando solicitado,
à consulta de Instagram. Os provedores que hospedam os recursos públicos do
projeto podem receber os dados técnicos normais de uma requisição HTTP, como
endereço IP e cabeçalhos, mas a extensão não envia o conteúdo dos resultados
para o arquivo de configuração.

## Permissões

- `storage`: guardar preferências, resultados e cache localmente;
- acesso à Biblioteca de Anúncios da Meta: executar a funcionalidade principal;
- acesso ao arquivo público de configuração no GitHub: receber parâmetros
  operacionais atualizáveis.

Não solicitamos a permissão `downloads`, porque os arquivos são entregues ao
navegador por uma ação de download iniciada pelo usuário.

## Alterações

Esta política pode ser atualizada quando a funcionalidade ou o tratamento de
dados mudar. A versão vigente ficará publicada neste arquivo e será refletida
na ficha da extensão quando necessário.
