---
name: codegraph
description: >-
  Use sempre que precisar localizar código, entender chamadas/dependências,
  avaliar impacto de mudar um símbolo, ou fazer varredura em qualquer projeto
  — antes de usar find/grep/ripgrep/glob/Read em loop para explorar. Cobre
  CodeGraph via MCP (codegraph_explore) e via CLI (codegraph) como fallback ou
  para comandos que o MCP não expõe (query, node, callers, callees, impact,
  affected, status, files, sync). Gatilhos: 'onde está definido', 'quem
  chama', 'quem usa', 'mapear arquivos', 'buscar símbolo', 'varrer projeto',
  'localizar função/classe', 'call path', 'blast radius', 'impacto de mudar',
  'testes afetados', 'codegraph', 'codegraph_explore'.
license: MIT
compatibility: >-
  Qualquer projeto com diretório .codegraph/ na raiz (criado via 'codegraph
  init'); binário 'codegraph' na CLI e/ou servidor MCP 'codegraph' registrado.
metadata:
  author: freedom
  version: "1.0"
---

# Using CodeGraph

Regra fixa: em projeto indexado (existe `.codegraph/` na raiz do projeto ou
sub-projeto), **CodeGraph é sempre a primeira ferramenta de busca/varredura
de código** — nunca `find`, `grep`/`ripgrep`, `glob` ou `Read` em loop
tentando "explorar" manualmente primeiro. CodeGraph é grafo de
símbolos+arestas: um único call devolve source verbatim já numerado dos
símbolos relevantes **+** call paths entre eles **+** blast radius —
substitui o ciclo grep→Read→grep→Read por um round-trip só, com mais precisão
(segue dynamic dispatch que grep não segue).

## Quando usar

- "onde está definido X" / "quem chama Y" / "quem usa Z"
- entender arquitetura de um serviço, mapear arquivo/módulo/diretório
- avaliar impacto de mudar um símbolo (blast radius) antes de editar
- descobrir quais testes cobrem um conjunto de arquivos alterados
- qualquer varredura ampla (>2-3 buscas) num projeto
- **antes de qualquer edição**: ver o símbolo alvo + quem o chama, pra não
  quebrar caller sem perceber

Não usar (cair pro fallback nativo) quando:
- projeto **não tem** `.codegraph/` (verificar com `ls .codegraph/` ou
  `codegraph status <path>` antes de assumir)
- busca é textual pura sem relação com símbolo/código (grep em log, string em
  JSON de dados, YAML de config, texto em Markdown)
- já se sabe o path exato do arquivo e é leitura pontual — `Read` direto é
  mais barato que explorar o grafo

## Duas superfícies: MCP e CLI

CodeGraph expõe **uma única MCP tool**: `codegraph_explore`
(`mcp__codegraph__codegraph_explore`). Ela cobre a esmagadora maioria dos
casos — é a "PRIMARY TOOL" do próprio server, pensada pra substituir sozinha
o loop search/Read/Grep.

Tudo que não é "explorar uma área" (busca cirúrgica de símbolo único, call
graph estrito, impact analysis com profundidade, testes afetados, estrutura
de arquivos, status do índice) só existe na **CLI** (`codegraph <comando>`),
não tem tool MCP equivalente. Use a CLI via Bash pra esses casos, mesmo com
MCP disponível.

```
Preciso explorar/entender uma área, símbolo, bug, fluxo?
  → MCP codegraph_explore (se disponível) — ou `codegraph explore` via shell se não

Preciso de algo mais cirúrgico que "explorar"?
  → sempre CLI, não existe MCP tool pra isso:
    - localizar símbolo por nome/kind        → codegraph query
    - ver 1 símbolo (source + trilha caller/callee) ou ler arquivo indexado → codegraph node
    - quem chama X                            → codegraph callers
    - o que X chama                           → codegraph callees
    - o que quebra se eu mudar X (blast radius, profundidade configurável) → codegraph impact
    - quais testes cobrem estes arquivos mudados → codegraph affected
    - árvore/estrutura de arquivos do índice  → codegraph files
    - índice existe? está em dia?             → codegraph status
    - reindexar após mudanças                 → codegraph sync
```

## Como usar — MCP (`codegraph_explore`)

Parâmetros:
- `query` (obrigatório): nomes de símbolo/arquivo e/ou pergunta em linguagem
  natural. Pode combinar vários símbolos numa query só pra pedir o call path
  entre eles (ex.: `"AuthService loginUser session-manager"`).
- `projectPath` (obrigatório): caminho absoluto do projeto ou de qualquer
  diretório dentro dele. CodeGraph resolve o `.codegraph/` mais próximo em ou
  acima desse path. Server é multi-projeto — não existe "projeto default" em
  monorepo, sempre passar explicitamente.
- `maxFiles` (opcional, default 12): teto de arquivos com source incluído.

Regras de uso:
1. Tratar o source retornado como **já lido** — não reabrir esses arquivos
   com `Read` depois.
2. Um call amplo resolve melhor que várias queries estreitas — prefira juntar
   os símbolos relevantes numa query só.
3. Pergunta em linguagem natural funciona direto, sem precisar de busca prévia
   por símbolo exato.

## Como usar — CLI (`codegraph <comando>`)

Todos os comandos abaixo aceitam `-p, --path <path>` (raiz do projeto; default
diretório atual) e a maioria aceita `-j, --json` pra saída estruturada.

- `codegraph explore "<query>" -p <path> [--max-files N]` — mesmo contrato e
  saída do MCP `codegraph_explore`; usar quando MCP não está disponível no
  ambiente.
- `codegraph query "<termo>" [-k <kind>] [-l <limit>] -p <path>` — busca
  símbolo por nome/kind (function, class, etc.) sem trazer call graph; mais
  barato que `explore` quando só se quer localizar, não entender.
- `codegraph node <nome> -p <path>` — um símbolo específico: source +
  trilha caller/callee. Com `-f <file>`: modo arquivo, lê o arquivo indexado
  com números de linha + dependentes (`--symbols-only` só traz o mapa de
  símbolos, `--offset`/`--limit` paginam).
- `codegraph callers <symbol> [-l N] -p <path>` — só quem chama.
- `codegraph callees <symbol> [-l N] -p <path>` — só o que o símbolo chama.
- `codegraph impact <symbol> [-d depth] -p <path>` — blast radius: o que é
  afetado ao mudar esse símbolo, com profundidade de travessia configurável.
  Rodar **antes** de editar símbolo com uso amplo/desconhecido.
- `codegraph affected [files...] [--stdin] [-d depth] [-f glob] -p <path>` —
  dado(s) arquivo(s) alterado(s), lista testes afetados. Útil pra decidir
  quais testes rodar depois de um patch.
- `codegraph files [--filter dir] [--pattern glob] [--format tree|flat|grouped] -p <path>` —
  estrutura de arquivos a partir do índice (mais rápido que `find` num
  projeto grande, já filtrado por linguagem/contagem de símbolos).
- `codegraph status [path] [-j]` — existe índice? quantos símbolos, quão
  recente. Rodar antes de assumir que `.codegraph/` está utilizável.
- `codegraph sync [path] [-q]` — reindexa incrementalmente desde a última
  indexação. Índice normalmente já atualiza sozinho com o projeto aberto, mas
  `sync` força se a resposta parecer defasada.

### Indexação — nunca proativa

`codegraph init [path]` cria `.codegraph/` e faz o índice inicial;
`codegraph uninit` remove. **Decisão do usuário, nunca rodar por conta
própria** — só sugerir quando não existir índice e a tarefa se beneficiar
claramente de um.

## Fallback e validação

1. Sem `.codegraph/` no projeto alvo → usar `Grep`/`Glob`/`find`/`Read`
   normalmente, sem tentar indexar sozinho.
2. Resposta do CodeGraph não cobriu o pedido (símbolo fora do índice, arquivo
   gerado/vendored, gap de linguagem não suportada) → complementar com `Grep`
   pontual, não recomeçar a exploração do zero.
3. **Validar sempre contra o código atual**: o índice reflete o estado da
   última sincronização. Se a resposta não bater com o arquivo real, confiar
   no arquivo, não no grafo — e considerar `codegraph sync` (ou sinalizar ao
   usuário que `codegraph init` pode estar defasado o bastante pra precisar
   reindexar do zero).

## Monorepo / múltiplos projetos

Cada sub-projeto indexado tem seu próprio `.codegraph/`. Sempre passar
`projectPath`/`-p` explícito apontando pro sub-projeto alvo — não existe
projeto default quando há vários `.codegraph/` na árvore. Delegar buscas por
área/diretório a subagents quando a varredura cobre múltiplos sub-projetos,
um subagent por área, pra não duplicar esforço e não inchar o contexto
principal com source de áreas que não vão ser usadas na decisão em curso.

## Referências

- [`references/codegraph-tool-contract.md`](references/codegraph-tool-contract.md):
  contrato completo de parâmetros/saída de cada comando CLI e da tool MCP.
