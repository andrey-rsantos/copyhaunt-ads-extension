# Ciclo da mineração e resultados parciais — Design

**Spec de origem:** `docs/superpowers/specs/2026-09-10-bloco-b-integracao-design.md`,
seções 7 e 8, mais a decisão aprovada na conversa de 2026-09-17.

## 1. Objetivo

Completar o ciclo de vida visível da mineração na Biblioteca de Anúncios:

- pausar uma mineração e abrir os aprovados parciais;
- retomar a mineração pausada;
- parar definitivamente uma mineração, preservando os aprovados parciais;
- iniciar uma nova mineração depois de um fim normal ou de uma interrupção;
- comunicar na página de resultados se o snapshot é parcial, interrompido ou
  final.

Esta entrega não cria histórico. O storage continua contendo somente o
snapshot mais recente, que pode ser substituído por um parcial da sessão atual.

## 2. Decisões de produto

### 2.1 Pausar

Ao clicar em `Pausar`:

1. o motor deixa de rolar e entra em `pausado`;
2. os aprovados conhecidos até aquele instante são persistidos imediatamente;
3. o cartão troca `Pausar` por `Retomar`;
4. aparecem `Ver resultados` e `Parar mineração`;
5. `Ver resultados` abre o snapshot parcial já salvo.

O snapshot pausado é deliberadamente parcial. A busca de Instagram não
participa da mineração; ela fica disponível sob demanda na página de
resultados, sem prolongar a sessão.

### 2.2 Parar mineração

`Parar mineração` encerra a sessão sem possibilidade de retomada. O motor
entra no novo estado terminal `interrompida`, a rolagem é interrompida e os
aprovados conhecidos são persistidos como snapshot parcial. O cartão oferece
`Ver resultados` e `Minerar novamente`.

A busca de Instagram também não é executada ao interromper. A interrupção é
uma ação explícita de parada e não deve prolongar a sessão com consultas que o
usuário não pediu naquele momento; o estado visual deixa claro que o resultado
é parcial.

### 2.3 Mineração novamente

`Minerar novamente` reutiliza os últimos critérios e o limite, mas cria uma
nova sessão do motor. A sessão anterior não é retomada nem somada ao contador
de aprovados.

O `AdStore` da aba continua vivo para que os enxertos existentes não sumam e
para que novas capturas continuem sendo indexadas. O novo `Minerador` recebe
os IDs que já estavam no store como avaliados inicialmente; assim, a nova
sessão procura lotes inéditos sem contar novamente os anúncios que já foram
processados. Se uma nova mineração for iniciada com critérios diferentes pela
gaveta, ela também usa essa mesma fronteira de IDs: a ação explícita significa
“continuar a busca nesta aba”, não reprocessar o histórico local inteiro.

### 2.4 Estados

O estado público passa a ser:

```ts
type EstadoMineracao =
  | 'parado'
  | 'minerando'
  | 'pausado'
  | 'interrompida'
  | 'concluido'
  | 'esgotado'
  | 'incompreensivel'
  | 'limite-seguranca'
```

Transições permitidas:

```text
parado       -> minerando
minerando    -> pausado | interrompida | concluido | esgotado |
                 incompreensivel | limite-seguranca
pausado      -> minerando | interrompida
estados finais -> nova instância de Minerador, por Mineração novamente
```

`interrompida` é diferente de `pausado`: o primeiro não pode ser retomado;
`pausado` pode. O motor não deve iniciar um estado terminal; iniciar novamente
é responsabilidade do controlador de sessão.

## 3. Persistência

A chave continua sendo `copyhaunt:resultado:v1`, sem histórico. O codec passa
a aceitar `estado: 'interrompida'`; a forma do anúncio e a serialização de
datas permanecem iguais.

O content script terá duas operações testáveis:

- `salvarResultadoParcial`: salva imediatamente os aprovados atuais com o
  estado `pausado` ou `interrompida`, sem pós-filtro e sem liberar ações de
  uma mineração concluída;
- `finalizarResultado`: salva imediatamente os aprovados para estados
  terminais normais e libera o atalho de resultados.

O snapshot parcial substitui o resultado anterior. A página de resultados não
deve chamar `fetch`, ler a sessão da Meta ou tentar completar um filtro por
conta própria; a busca de Instagram ocorre somente pelo comando explícito no
menu `Links`.

Se uma gravação parcial falhar, o erro é registrado pelo adaptador já
existente e o cartão não deve fingir que `Ver resultados` está disponível.
Uma nova tentativa só ocorre por outra ação do usuário.

## 4. Cartão de progresso

O componente puro de progresso passa a receber callbacks separados para:

- pausar/retomar;
- abrir resultados;
- parar a mineração;
- iniciar novamente.

Comportamento visual:

| Estado | Ações visíveis |
|---|---|
| `minerando` | `Pausar` |
| `pausado` | `Retomar`, `Ver resultados`, `Parar mineração` |
| `interrompida` | `Ver resultados`, `Minerar novamente` |
| terminal normal | `Ver resultados`, `Minerar novamente` |

Enquanto o snapshot parcial ainda está sendo salvo, `Ver resultados` permanece
desabilitado. O rótulo do estado deve comunicar `Pausado` ou `Mineração
interrompida`; não usar “concluída” para parciais.

O botão `Minerar novamente` reabre a gaveta de mineração com os últimos dados
de `PedidoMineracao` preenchidos, sem apagar o overlay já plantado. A próxima
sessão só começa depois de o usuário confirmar em `Iniciar mineração`, com
contadores do motor zerados e com os IDs presentes no `AdStore` marcados como
já avaliados.

## 5. Página de resultados

O cabeçalho deve exibir, além da quantidade e origem atuais, um rótulo de
estado:

- `Resultados parciais — mineração pausada`;
- `Resultados parciais — mineração interrompida`;
- `Mineração concluída`, `Fim dos resultados` ou `Mineração encerrada`
  para os estados normais existentes.

Os cards e o menu `Links` continuam exatamente como na spec da tela de
resultados. A página não recebe responsabilidade de controlar o motor: ela
somente lê o snapshot salvo.

## 6. Fronteiras de código

- `src/core/miner.ts`: estado `interrompida`, método explícito de interrupção
  e IDs avaliados inicialmente; nenhuma persistência ou DOM.
- `src/core/resultados.ts`: codec do novo estado e rótulo/semântica de estado
  para a UI.
- `src/content/resultados.ts`: salvamento de parciais e finalização normal,
  mantendo o adaptador de storage injetável.
- `src/content/progresso.ts`: ações e visibilidade do cartão.
- `src/content/index.ts`: controlador da sessão, último `PedidoMineracao`,
  troca por nova instância e persistência nos pontos corretos.
- `src/resultados/App.tsx` e estilos: estado do snapshot no cabeçalho.

Nenhuma permissão do manifest deve mudar.

## 7. Verificação

Antes da implementação, testes unitários devem falhar para:

- transição `minerando -> pausado -> minerando`;
- transição `minerando/pausado -> interrompida` sem possibilidade de retomar;
- nova instância ignorando IDs que já estavam no store;
- gravação de parcial em pausa e interrupção;
- finalização normal salvando e liberando resultados sem aguardar consultas de
  Instagram;
- cartão exibindo as ações corretas em cada estado;
- página distinguindo snapshot pausado, interrompido e terminal.

Verificação final:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
```

Não executar `npm.cmd run gravar:fixtures`.
