# Contrato das ferramentas CodeGraph

## MCP — `codegraph_explore` (`mcp__codegraph__codegraph_explore`)

Única tool MCP exposta pelo server (`codegraph serve --mcp`). Descrita pelo
próprio server como "PRIMARY TOOL — call FIRST for almost any question OR
before an edit".

Parâmetros (`inputSchema`):
- `query` (string, obrigatório): nomes de símbolo, arquivo, ou termos curtos
  de código a explorar (ex.: `"AuthService loginUser session-manager"`,
  `"GraphTraverser BFS impact traversal.ts"`). Pra pergunta de fluxo, citar os
  símbolos que atravessam o fluxo. Pergunta em linguagem natural funciona
  direto, sem busca prévia.
- `projectPath` (string, obrigatório): caminho absoluto do projeto, ou
  qualquer diretório dentro dele. CodeGraph resolve o `.codegraph/` mais
  próximo em ou acima desse path. Server multi-projeto — sem projeto default;
  sempre passar explícito, principalmente em monorepo onde só sub-projetos
  têm índice.
- `maxFiles` (number, opcional, default `12`): teto de arquivos com source
  incluído na resposta.

Saída: source verbatim numerado por linha dos símbolos relevantes, agrupado
por arquivo, num único call já capado (tratar como equivalente a `Read` —
não reabrir os arquivos retornados) + call paths entre os símbolos.

Anotações: `readOnlyHint: true`, `destructiveHint: false`,
`idempotentHint: true`, `openWorldHint: false` — seguro chamar quantas vezes
precisar, não modifica nada.

## CLI (`codegraph <comando>`)

Binário `codegraph`. Comandos com tool MCP equivalente: só `explore`. Todos
os demais são CLI-only.

### `codegraph explore <query...> [-p path] [--max-files N]`
Mesmo contrato/saída do MCP `codegraph_explore`. Usar quando MCP não
disponível no ambiente, ou quando rodando fora de um agente com MCP.

### `codegraph query <search> [-p path] [-l limit=10] [-k kind] [-j]`
Busca símbolos por nome (com filtro opcional de `kind`: function, class,
etc.). Não traz call graph nem source completo — mais barato que `explore`
quando só se quer localizar/confirmar existência de um símbolo.

### `codegraph node [name] [-p path] [-f file] [--offset N] [--limit N] [--symbols-only]`
Mesma saída do MCP `codegraph_node` (tool que não está registrada neste
server, só existe via CLI/binário local). Dois modos:
- **símbolo**: `name` é nome de símbolo → source do símbolo + trilha de
  caller/callee.
- **arquivo** (`-f file` ou `name` ambíguo desambiguado por arquivo): lê o
  arquivo indexado com números de linha + lista de dependentes. `--offset`/
  `--limit` paginam arquivo grande; `--symbols-only` retorna só o mapa de
  símbolos + dependentes, sem o corpo do arquivo.

### `codegraph callers <symbol> [-p path] [-l limit=20] [-j]`
Lista funções/métodos que chamam o símbolo. Subconjunto de `impact`/`node`,
mais direto quando só se quer a lista de callers.

### `codegraph callees <symbol> [-p path] [-l limit=20] [-j]`
Lista funções/métodos que o símbolo chama. Inverso de `callers`.

### `codegraph impact <symbol> [-p path] [-d depth=2] [-j]`
Blast radius: travessia do grafo a partir do símbolo até `depth` hops,
retornando tudo que é afetado por uma mudança nele. Rodar antes de editar
símbolo com uso amplo ou desconhecido — mais barato que descobrir o impacto
depois, em produção.

### `codegraph affected [files...] [-p path] [--stdin] [-d depth=5] [-f glob] [-j] [-q]`
Dado um conjunto de arquivos alterados (por argumento ou `--stdin`, um por
linha), retorna arquivos de teste afetados via travessia de dependência.
`-f/--filter` restringe a um glob custom de teste (ex.: `"e2e/*.spec.ts"`).
`-q/--quiet` só imprime paths, sem decoração — bom pra pipe em `xargs`/CI.

### `codegraph files [-p path] [--filter dir] [--pattern glob] [--format tree|flat|grouped] [--max-depth N] [--no-metadata] [-j]`
Estrutura de arquivos a partir do índice (não do filesystem ao vivo) —
inclui linguagem e contagem de símbolos por arquivo por default
(`--no-metadata` remove). Mais rápido que `find`/`tree` num projeto grande já
indexado, e já filtrado por relevância de código (ignora vendored/gerado
conforme config de indexação).

### `codegraph status [path] [-j]`
Existe índice em `path`? Estatísticas: quantidade de símbolos, arquivos,
timestamp da última sincronização. Primeiro comando a rodar quando não se
tem certeza se o projeto está indexado ou se o índice está fresco.

### `codegraph sync [path] [-q]`
Reindexação incremental desde o último índice (não um rebuild completo).
Índice normalmente atualiza sozinho enquanto o agente/editor está com o
projeto aberto; `sync` força quando a resposta de `explore`/`node`/etc.
parecer desatualizada frente ao arquivo real.

### `codegraph index [path]`
Rebuild completo do zero — mesmo resultado de um `init` novo. Mais custoso
que `sync`; usar só se `sync` não resolver a defasagem.

### `codegraph init [path] [-f] [-v]` / `codegraph uninit [path]`
Cria/remove `.codegraph/`. **Nunca rodar proativamente** — indexar um
projeto é decisão do usuário. `-f/--force` ignora a checagem de segurança que
bloqueia indexar home dir ou raiz do filesystem por engano.

### `codegraph unlock [path]`
Remove lock file obsoleto que está travando indexação (processo anterior
morreu sem liberar o lock). Só usar se `sync`/`index` travar reclamando de
lock.

### `codegraph daemon` / `codegraph daemons`
Gerencia daemons de indexação em background rodando no host — lista e
permite parar. Diagnóstico, não path normal de uso.

### `codegraph install` / `codegraph uninstall`
Registra/remove o server MCP do CodeGraph em agentes suportados (Claude
Code, Cursor, Codex CLI, opencode, Hermes Agent). Ação de setup de máquina —
rodar só a pedido explícito do usuário, nunca como parte de uma tarefa de
código.

## Quando NÃO existe `.codegraph/`

Fallback pra ferramentas nativas (`Grep`, `Glob`/`find`, `Read`) — sem tentar
indexar por conta própria. Confirmar ausência com `codegraph status <path>`
ou `ls <path>/.codegraph/` antes de descartar CodeGraph.
