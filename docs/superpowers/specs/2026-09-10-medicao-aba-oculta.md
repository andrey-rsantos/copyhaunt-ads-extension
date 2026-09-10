# Medição — mineração com a aba oculta

**Data:** 2026-09-10  
**Ambiente:** Chromium provisório, perfil descartável, sem login no Facebook e
sem porta de depuração durante a medição.

## Resultado

**Divergência do método escrito no plano.** O Step 3 da Task 1 manda ocultar a
aba abrindo outra aba e permanecendo nela. Aqui a janela inteira foi
minimizada. As duas põem a página em `visibilityState: "hidden"`, que é o que
o critério mede, mas não são idênticas para o *throttling* do Chrome: a janela
minimizada é o caso mais severo dos dois. Quem reproduzir esta medição por
qualquer um dos dois caminhos deve chegar ao mesmo veredito; se não chegar, o
caminho é a primeira suspeita.

O navegador foi iniciado normalmente e minimizado. Um instrumento temporário
da extensão gravou apenas `visibilityState` e o progresso no
`chrome.storage.local`; ele foi removido e o build definitivo foi refeito ao
final.

```json
{
  "amostrasOcultas": 22,
  "rolagensOcultas": "2 → 10",
  "pausa": "pausado aos 30 s",
  "retomada": "minerando aos 36 s, com nova rolagem observada",
  "buscaVazia": "esgotado",
  "captchaOuBloqueio": false,
  "errosDePagina": []
}
```

**Leitura do JSON contra o critério do plano.** A tabela de veredito do Step 3
decide por `amostrasOcultas`, `lotesOcultos` e crescimento da altura da página.
O instrumento desta medição não contou lotes nem altura diretamente: contou
`rolagensOcultas`, que é o sinal derivado dos dois. O laço só rola de novo
depois de o lote anterior chegar — é o comportamento reativo que a Task 4
implantou —, e só há o que rolar se a página cresceu. Logo `rolagensOcultas`
indo de 2 a 10 com a aba oculta implica `lotesOcultos > 0` e altura crescente,
e satisfaz a linha "passou" da tabela. Um instrumento futuro deve gravar os
três campos com os nomes do critério, para dispensar esta ponte.

Uma execução anterior do mesmo instrumento, também sem CDP, observou 19
amostras ocultas, 0 → 22 rolagens e 0 → 152 anúncios analisados. Ela revelou
um falso `esgotado` após duas voltas vazias; a Task 8 do plano corrigiu o
limiar e a medição acima validou pausa e retomada depois da correção.

**Veredito: passou.** O relógio de Worker e a rolagem continuam ativos com a
página realmente oculta. Não houve sinal de rate limit, CAPTCHA ou bloqueio de
IP durante as sessões cautelosas.
