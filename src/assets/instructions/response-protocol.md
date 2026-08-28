# Resposta Final e Indexação de Memória

Ao concluir qualquer tarefa, análise, implementação, investigação ou pesquisa, siga
obrigatoriamente as regras abaixo.

## Objetivo

- Minimizar consumo de tokens.
- Maximizar densidade de informação.
- Facilitar indexação e recuperação futura por agentes de memória, RAG, busca semântica
  e busca por palavras-chave.
- Evitar respostas longas e redundantes.

## Tamanho da resposta

Por padrão:

- Responda em no máximo 5 linhas.
- Não repita contexto já conhecido.
- Não explique o raciocínio interno.
- Não reproduza análises extensas.

Somente produza respostas detalhadas quando o usuário solicitar explicitamente:
`detalhe`, `detalhar`, `explique`, `aprofundar`, `análise completa`, `relatório`,
`documentação`, `full`.

## Estrutura obrigatória

```
STATUS: SUCCESS | PARTIAL | FAILED

RESUMO:
<1 a 3 frases objetivas>

ARQUIVOS:
<arquivos afetados ou N/A>

DECISOES:
- item
- item

RISCOS:
- item
- item

PROXIMA_ACAO:
<ação recomendada ou N/A>
```

## Decisões técnicas

Sempre que houver definição arquitetural ou funcional relevante, registre a decisão e o
impacto.

```
DECISOES:
- utilizar MongoDB como banco principal
- adotar Clean Architecture
- utilizar Kafka para integração assíncrona
```

## Riscos

Sempre registrar riscos identificados. Quando não houver, escrever `N/A`.

```
RISCOS:
- possibilidade de duplicidade em reprocessamentos Kafka
- crescimento excessivo da coleção Mongo
```

## Arquivos

Quando houver alteração de código, listar os caminhos afetados; caso contrário, `N/A`.

```
ARQUIVOS:
- src/main/java/...
- docker-compose.yml
```

## Formato de resposta curta

```
STATUS: SUCCESS

RESUMO:
Consumer Kafka ajustado para processamento em lote e commit manual.

ARQUIVOS:
KafkaConsumer.java

DECISOES:
- manter ack manual
- processar mensagens em lote

RISCOS:
- aumento de memória por lote excessivo

PROXIMA_ACAO:
Executar teste de carga.
```

## Formato de resposta detalhada

Quando solicitado explicitamente, manter a mesma estrutura acima, porém expandir
`RESUMO`, `DECISOES`, `RISCOS` e `PROXIMA_ACAO` com explicações completas.

## Regra fundamental

A qualidade da indexação futura é mais importante que a fluidez textual. Sempre
priorize, nesta ordem:

1. precisão técnica
2. decisões registradas
3. baixo consumo de tokens
4. consistência estrutural
