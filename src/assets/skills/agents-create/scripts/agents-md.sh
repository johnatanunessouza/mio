#!/usr/bin/env bash
#
# agents-md.sh — Gera/atualiza AGENTS.md em qualquer projeto, orientado por escopo.
#                Agnóstico de linguagem: detecta a stack, mapeia a árvore de pastas
#                e extrai comandos reais dos manifests encontrados em runtime.
#
# A geração é SEMPRE orientada: o chamador escolhe ONDE gerar.
#   --list                 Lista nós candidatos + stack detectada (não escreve nada).
#   --detect <dir>         Mostra comandos + stack + árvore de um diretório.
#   --tree [dir]           Imprime só a árvore de pastas (default: raiz).
#   --root                 Gera/atualiza só ./AGENTS.md (na raiz do repo).
#   --node <caminho>       Gera/atualiza AGENTS.md dentro de <caminho>/.
#   --all                  Gera na raiz + em cada nó detectado.
#
# Opções:
#   --root-dir <path>      Raiz do repo (default: auto a partir do cwd).
#   --type <t>             Força o tipo do template (root|service|app|library|generic).
#   --depth <n>            Profundidade de varredura de nós (default: 2).
#   --dry-run              Mostra o que faria, sem escrever.
#   -h|--help
#
# Preserva conteúdo manual: só reescreve o bloco entre os marcadores
#   <!-- BEGIN GENERATED: mio:agents-create --> ... <!-- END GENERATED: mio:agents-create -->
# Tudo fora do bloco é mantido. Arquivo novo recebe scaffold (bloco + seções manuais vazias).

set -euo pipefail

BEGIN_MARK="<!-- BEGIN GENERATED: mio:agents-create -->"
END_MARK="<!-- END GENERATED: mio:agents-create -->"
# Marcadores da versão anterior da skill (generate-agents-md), reconhecidos na
# leitura para que um AGENTS.md já existente seja atualizado, não duplicado.
LEGACY_BEGIN_MARK="<!-- BEGIN GENERATED: generate-agents-md -->"
LEGACY_END_MARK="<!-- END GENERATED: generate-agents-md -->"

ROOT_DIR=""
MODE=""
NODE_ARG=""
FORCE_TYPE=""
DEPTH=2
DRY=0
ROOT_DIR_SET=0

# Diretórios ignorados na descoberta e na árvore: ruído de build/IDE e os
# diretórios que os próprios agentes mantêm no repo.
PRUNE_NAMES="node_modules .git dist build target out .next .nuxt .venv venv __pycache__ \
.gradle .idea .vscode vendor obj coverage .terraform .mvn .pytest_cache .cache \
.agents .agent .claude .codex .codegraph .cursor .github .gemini .windsurf .devin \
.opencode .qoder .roo .trae .kiro .junie .continue .cline .amazonq"

TMP_FILES=()
cleanup() { [ ${#TMP_FILES[@]} -eq 0 ] || rm -f "${TMP_FILES[@]}"; }
trap cleanup EXIT

# ---------- args ----------
while [ $# -gt 0 ]; do
  case "$1" in
    --list)     MODE="list"; shift ;;
    --detect)   MODE="detect"; NODE_ARG="${2:-}"; shift 2 ;;
    --tree)     MODE="tree"; if [ $# -ge 2 ] && [ "${2#-}" = "$2" ]; then NODE_ARG="$2"; shift 2; else shift; fi ;;
    --root)     MODE="root"; shift ;;
    --node)     MODE="node"; NODE_ARG="${2:-}"; shift 2 ;;
    --all)      MODE="all"; shift ;;
    --root-dir) ROOT_DIR="${2:-}"; ROOT_DIR_SET=1; shift 2 ;;
    --type)     FORCE_TYPE="${2:-}"; shift 2 ;;
    --depth)    DEPTH="${2:-2}"; shift 2 ;;
    --dry-run)  DRY=1; shift ;;
    -h|--help)  grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Argumento desconhecido: $1" >&2; exit 2 ;;
  esac
done
[ -n "$MODE" ] || { echo "ERRO: escolha um escopo (--list/--root/--node/--all/--detect/--tree). Veja --help." >&2; exit 2; }
case "$DEPTH" in ''|*[!0-9]*) echo "ERRO: --depth espera um inteiro, recebeu: $DEPTH" >&2; exit 2 ;; esac
if [ -n "$FORCE_TYPE" ]; then
  case "$FORCE_TYPE" in
    root|service|app|library|generic) ;;
    *) echo "ERRO: --type aceita root|service|app|library|generic, recebeu: $FORCE_TYPE" >&2; exit 2 ;;
  esac
fi

# ---------- localizar raiz do repo ----------
# Guard: --root-dir passado mas vazio/inexistente é erro (evita cair no cwd por engano).
if [ "$ROOT_DIR_SET" -eq 1 ]; then
  [ -n "$ROOT_DIR" ] || { echo "ERRO: --root-dir foi passado vazio." >&2; exit 2; }
  [ -d "$ROOT_DIR" ] || { echo "ERRO: --root-dir não existe: $ROOT_DIR" >&2; exit 2; }
fi
if [ -z "$ROOT_DIR" ]; then
  d="$PWD"
  while [ "$d" != "/" ]; do
    if [ -d "$d/.git" ] || [ -d "$d/openspec" ] || [ -d "$d/.agents/skills" ]; then ROOT_DIR="$d"; break; fi
    d="$(dirname "$d")"
  done
  [ -n "$ROOT_DIR" ] || ROOT_DIR="$PWD"
fi
ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"

# helper: imprime "—" quando a detecção não achou nada (funções sempre saem com 0,
# então `|| echo` nunca dispararia).
or_dash() { local v="$1"; [ -n "$v" ] && echo "$v" || echo "—"; }

# helper: monta os args de prune para find
_prune_args() {
  local first=1
  for n in $PRUNE_NAMES; do
    if [ $first -eq 1 ]; then printf -- '-name %s ' "$n"; first=0
    else printf -- '-o -name %s ' "$n"; fi
  done
}

# ---------- detecção de manifests (marcadores de "nó") ----------
# Agnóstico: cobre os ecossistemas mais comuns do mercado.
node_markers() {
  local dir="$1" m=""
  # JS/TS
  [ -f "$dir/package.json" ]        && m="$m package.json"
  [ -f "$dir/deno.json" ]           && m="$m deno.json"
  [ -f "$dir/bun.lockb" ]           && m="$m bun"
  # JVM
  [ -f "$dir/pom.xml" ]             && m="$m pom.xml"
  [ -f "$dir/build.gradle" ]        && m="$m build.gradle"
  [ -f "$dir/build.gradle.kts" ]    && m="$m build.gradle.kts"
  # Python
  [ -f "$dir/pyproject.toml" ]      && m="$m pyproject.toml"
  [ -f "$dir/setup.py" ]            && m="$m setup.py"
  [ -f "$dir/requirements.txt" ]    && m="$m requirements.txt"
  # Go / Rust
  [ -f "$dir/go.mod" ]              && m="$m go.mod"
  [ -f "$dir/Cargo.toml" ]          && m="$m Cargo.toml"
  # PHP / Ruby / .NET / Elixir / Dart
  [ -f "$dir/composer.json" ]       && m="$m composer.json"
  [ -f "$dir/Gemfile" ]             && m="$m Gemfile"
  [ -f "$dir/mix.exs" ]             && m="$m mix.exs"
  [ -f "$dir/pubspec.yaml" ]        && m="$m pubspec.yaml"
  ls "$dir"/*.csproj   >/dev/null 2>&1 && m="$m csproj"
  ls "$dir"/*.sln      >/dev/null 2>&1 && m="$m sln"
  # Genéricos de orquestração/build
  [ -f "$dir/Makefile" ]            && m="$m Makefile"
  [ -f "$dir/Taskfile.yml" ]        && m="$m Taskfile.yml"
  [ -f "$dir/justfile" ]            && m="$m justfile"
  [ -f "$dir/docker-compose.yml" ]  && m="$m docker-compose.yml"
  [ -f "$dir/docker-compose.yaml" ] && m="$m docker-compose.yaml"
  [ -f "$dir/Dockerfile" ]          && m="$m Dockerfile"
  echo "${m# }"
}

# linguagem(ns) primária(s) de um nó (heurística por manifest)
node_langs() {
  local dir="$1" l=""
  [ -f "$dir/package.json" ] && { grep -q '"typescript"' "$dir/package.json" 2>/dev/null && l="$l TypeScript" || l="$l JavaScript"; }
  [ -f "$dir/deno.json" ]    && l="$l Deno/TS"
  { [ -f "$dir/pom.xml" ] || ls "$dir"/*.gradle* >/dev/null 2>&1; } && l="$l JVM(Java/Kotlin)"
  { [ -f "$dir/pyproject.toml" ] || [ -f "$dir/setup.py" ] || [ -f "$dir/requirements.txt" ]; } && l="$l Python"
  [ -f "$dir/go.mod" ]       && l="$l Go"
  [ -f "$dir/Cargo.toml" ]   && l="$l Rust"
  [ -f "$dir/composer.json" ]&& l="$l PHP"
  [ -f "$dir/Gemfile" ]      && l="$l Ruby"
  [ -f "$dir/mix.exs" ]      && l="$l Elixir"
  [ -f "$dir/pubspec.yaml" ] && l="$l Dart/Flutter"
  ls "$dir"/*.csproj >/dev/null 2>&1 && l="$l .NET/C#"
  echo "${l# }"
}

# tipo do nó por heurística agnóstica (app | service | library | generic)
# - service: tem Dockerfile/compose, ou framework de servidor web
# - app: tem framework de UI (web/mobile/desktop)
# - library: manifest sem entrypoint de app/serviço (lib publicável)
node_type() {
  local dir="$1"
  # UI/app (frontend web, mobile, desktop)
  if [ -f "$dir/package.json" ] && grep -Eq '"(react|react-dom|vue|svelte|solid-js|@angular/core|vite|next|nuxt|expo|react-native|electron)"' "$dir/package.json" 2>/dev/null; then
    echo "app"; return
  fi
  [ -f "$dir/pubspec.yaml" ] && grep -q 'flutter' "$dir/pubspec.yaml" 2>/dev/null && { echo "app"; return; }
  # service: container ou framework de servidor
  if [ -f "$dir/Dockerfile" ] || [ -f "$dir/docker-compose.yml" ] || [ -f "$dir/docker-compose.yaml" ]; then
    echo "service"; return
  fi
  if [ -f "$dir/package.json" ] && grep -Eq '"(express|fastify|koa|nest|@nestjs/core|hapi)"' "$dir/package.json" 2>/dev/null; then
    echo "service"; return
  fi
  # Rust: lib se tiver src/lib.rs e não [[bin]]; senão service (binário)
  if [ -f "$dir/Cargo.toml" ]; then
    if [ -f "$dir/src/lib.rs" ] && ! grep -q '\[\[bin\]\]' "$dir/Cargo.toml" 2>/dev/null; then echo "library"; return; fi
    echo "service"; return
  fi
  # Go: lib se não houver package main em nenhum .go de topo; senão service
  if [ -f "$dir/go.mod" ]; then
    if grep -rqs '^package main' "$dir"/*.go "$dir"/cmd 2>/dev/null; then echo "service"; return; fi
    echo "library"; return
  fi
  { [ -f "$dir/pom.xml" ] || ls "$dir"/*.gradle* >/dev/null 2>&1 \
    || [ -f "$dir/pyproject.toml" ] || [ -f "$dir/composer.json" ] \
    || [ -f "$dir/Gemfile" ] || [ -f "$dir/mix.exs" ]; } && { echo "service"; return; }
  [ -f "$dir/package.json" ] && { echo "library"; return; }
  echo "generic"
}

discover_nodes() {
  # shellcheck disable=SC2046
  find "$ROOT_DIR" -mindepth 1 -maxdepth "$DEPTH" -type d \
    \( $(_prune_args) \) -prune -o \
    -type d -print 2>/dev/null | while IFS= read -r dir; do
      [ "$dir" = "$ROOT_DIR" ] && continue
      m="$(node_markers "$dir")"
      [ -n "$m" ] || continue
      echo "$dir"
  done | sort -u
}

# ---------- árvore de pastas (desenho da arquitetura) ----------
# Usa `tree` se disponível (mais bonito), senão um fallback portátil.
print_tree() {
  local dir="$1" maxdepth="${2:-3}"
  if command -v tree >/dev/null 2>&1; then
    local ign; ign="$(echo "$PRUNE_NAMES" | tr -s ' \\\n' '|' | sed 's/|$//; s/^|//')"
    ( cd "$dir" && tree -d -L "$maxdepth" -I "$ign" --noreport 2>/dev/null ) && return
  fi
  # fallback: find + indentação por profundidade
  echo "$(basename "$dir")/"
  # shellcheck disable=SC2046
  find "$dir" -mindepth 1 -maxdepth "$maxdepth" -type d \
    \( $(_prune_args) \) -prune -o -type d -print 2>/dev/null | sort | while IFS= read -r d; do
      [ "$d" = "$dir" ] && continue
      rel="${d#"$dir"/}"
      depth="$(printf '%s' "$rel" | tr -cd '/' | wc -c)"
      indent=""; i=0
      while [ "$i" -le "$depth" ]; do indent="$indent  "; i=$((i+1)); done
      echo "${indent}${rel##*/}/"
  done
}

# ---------- extrair nomes de scripts do package.json ----------
pkg_scripts() {
  local pkg="$1"
  if command -v node >/dev/null 2>&1; then
    node -e 'try{const s=require(process.argv[1]).scripts||{};Object.keys(s).forEach(k=>console.log(k))}catch(e){process.exit(1)}' "$pkg" 2>/dev/null && return
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys;
d=json.load(open(sys.argv[1]));
[print(k) for k in (d.get("scripts") or {})]' "$pkg" 2>/dev/null && return
  fi
  awk '
    BEGIN { RS="\0" }
    {
      n=length($0); depth=0; out=""
      i=index($0,"\"scripts\"")
      if (i==0) exit
      j=i
      while (j<=n && substr($0,j,1)!="{") j++
      if (j>n) exit
      depth=1; j++
      while (j<=n && depth>0) {
        c=substr($0,j,1)
        if (c=="{") depth++
        else if (c=="}") depth--
        if (depth>0) out=out c
        j++
      }
      print out
    }
  ' "$pkg" 2>/dev/null \
    | grep -Eo '"[a-zA-Z0-9:_.-]+"[[:space:]]*:' | sed -E 's/"[[:space:]]*:$//; s/^"//' \
    | sort -u
}

# detecta o package manager JS pelo lockfile
js_pm() {
  local dir="$1"
  [ -f "$dir/pnpm-lock.yaml" ] && { echo "pnpm"; return; }
  [ -f "$dir/yarn.lock" ]      && { echo "yarn"; return; }
  [ -f "$dir/bun.lockb" ]      && { echo "bun"; return; }
  echo "npm"
}

# ---------- detecção de comandos (agnóstica) ----------
detect_commands() {
  local dir="$1"
  local rel="${dir#"$ROOT_DIR"/}"; [ "$rel" = "$dir" ] && rel="."
  echo "### Comandos detectados em \`${rel}\`"
  echo ""
  local found=0
  if [ -f "$dir/package.json" ]; then
    found=1; local pm; pm="$(js_pm "$dir")"
    echo "- **JS/TS** (\`package.json\`, pm: \`$pm\`):"
    echo "  - \`$pm install\`"
    pkg_scripts "$dir/package.json" | while read -r s; do
      [ -n "$s" ] || continue
      if [ "$pm" = "npm" ]; then echo "  - \`npm run $s\`"; else echo "  - \`$pm $s\`"; fi
    done
  fi
  [ -f "$dir/deno.json" ] && { found=1; echo "- **Deno**: \`deno task\` (ver tasks no \`deno.json\`) · \`deno test\`"; }
  if [ -f "$dir/pom.xml" ]; then found=1; echo "- **Maven** (\`pom.xml\`): \`mvn -B clean package\` · testes: \`mvn -B test\`"; fi
  if [ -f "$dir/build.gradle" ] || [ -f "$dir/build.gradle.kts" ]; then found=1; echo "- **Gradle**: \`./gradlew build\` · testes: \`./gradlew test\`"; fi
  if [ -f "$dir/pyproject.toml" ] || [ -f "$dir/setup.py" ] || [ -f "$dir/requirements.txt" ]; then
    found=1; echo "- **Python**: instalar/rodar/testar conforme tool (poetry/uv/pip + pytest) _(verify before running)_"
  fi
  if [ -f "$dir/go.mod" ]; then found=1; echo "- **Go**: \`go build ./...\` · \`go test ./...\` · \`go run .\`"; fi
  if [ -f "$dir/Cargo.toml" ]; then found=1; echo "- **Rust**: \`cargo build\` · \`cargo test\` · \`cargo run\`"; fi
  if [ -f "$dir/composer.json" ]; then found=1; echo "- **PHP/Composer**: \`composer install\` · scripts em \`composer.json\` _(verify before running)_"; fi
  if [ -f "$dir/Gemfile" ]; then found=1; echo "- **Ruby/Bundler**: \`bundle install\` · \`bundle exec rake\` _(verify before running)_"; fi
  if [ -f "$dir/mix.exs" ]; then found=1; echo "- **Elixir/Mix**: \`mix deps.get\` · \`mix compile\` · \`mix test\`"; fi
  if [ -f "$dir/pubspec.yaml" ]; then found=1; echo "- **Dart/Flutter**: \`flutter pub get\` · \`flutter run\` · \`flutter test\` _(verify before running)_"; fi
  if ls "$dir"/*.csproj >/dev/null 2>&1 || ls "$dir"/*.sln >/dev/null 2>&1; then found=1; echo "- **.NET**: \`dotnet restore\` · \`dotnet build\` · \`dotnet test\`"; fi
  if [ -f "$dir/Makefile" ]; then
    found=1; echo "- **Make** (targets):"
    grep -E '^[a-zA-Z0-9_.-]+:' "$dir/Makefile" 2>/dev/null | sed 's/:.*//' | sort -u | head -20 \
      | while read -r t; do echo "  - \`make $t\`"; done
  fi
  [ -f "$dir/Taskfile.yml" ] && { found=1; echo "- **Task**: \`task --list\` para ver tasks"; }
  [ -f "$dir/justfile" ]     && { found=1; echo "- **just**: \`just --list\`"; }
  if [ -f "$dir/docker-compose.yml" ] || [ -f "$dir/docker-compose.yaml" ]; then
    found=1; echo "- **Docker Compose**: \`docker compose up -d\` · \`docker compose build\` _(verify before running)_"
  fi
  [ -f "$dir/Dockerfile" ] && { found=1; echo "- **Docker**: \`docker build -t <img> .\` _(verify before running)_"; }
  [ "$found" -eq 1 ] || echo "- _(nenhum comando detectado — verify before running)_"
}

# ---------- contexto OpenSpec (opcional) ----------
openspec_block() {
  command -v openspec >/dev/null 2>&1 || return 0
  [ -d "$ROOT_DIR/openspec" ] || return 0
  echo "## Workflow OpenSpec"
  echo ""
  echo "Este repo usa OpenSpec como fonte de contexto de produto/spec. Antes de mudanças não-triviais:"
  echo ""
  echo '```bash'
  echo "openspec list --specs --json"
  echo "openspec list --changes --json"
  echo "openspec validate --all --json"
  echo '```'
  echo ""
  echo "Fluxo: explore → propose → apply → (verify) → sync → archive."
}

# ---------- convenções de código (fixas, entram em todo nó) ----------
code_conventions_block() {
  cat <<'EOF'
## Convenções de código (obrigatório)

- **Não escreva comentários no código.** Nenhum comentário de linha ou de bloco
  (`//`, `/* */`, `#`, `--`) deve ser adicionado em código novo ou alterado.
- **Não gere documentação embutida**: sem docstrings, JSDoc/TSDoc, Javadoc, KDoc,
  XML docs, `/** ... */`, `"""..."""`, `@param`, `@return`, `@throws`.
- O código se explica por **nomes e estrutura**: nomes descritivos, funções curtas,
  responsabilidade única, early return. Se um trecho só fica claro com comentário,
  extraia uma função com nome que diga a intenção.
- **Não remova comentários já existentes** no projeto sem pedido explícito do usuário.
  A regra vale para o que você escreve, não é autorização para limpar o legado.
- Documentação de projeto vive em Markdown (este `AGENTS.md`, `README`), nunca no código.
EOF
}

# ---------- templates por tipo (só o bloco GENERATED) ----------
generated_block() {
  local dir="$1" type="$2"
  echo "$BEGIN_MARK"
  echo "<!-- Regenerável por mio:agents-create. Edite FORA deste bloco para conteúdo manual. -->"
  echo ""
  case "$type" in
    root)
      echo "# AGENTS.md — $(basename "$ROOT_DIR")"
      echo ""
      echo "## Tipo de projeto"
      echo ""
      local nodes; nodes="$(discover_nodes)"
      local ncount; ncount="$(printf '%s\n' "$nodes" | grep -c . || true)"
      if [ "${ncount:-0}" -gt 1 ]; then
        echo "- **Monorepo** — $ncount nós com manifest detectados (ver abaixo)."
      elif [ "${ncount:-0}" -eq 1 ]; then
        echo "- **Repositório de módulo único** (1 nó interno detectado)."
      else
        echo "- **Projeto único** — manifest(s) na raiz: $(or_dash "$(node_markers "$ROOT_DIR")")"
      fi
      echo "- Stack detectada na raiz: $(or_dash "$(node_langs "$ROOT_DIR")")"
      echo ""
      echo "## Estrutura do repositório (árvore)"
      echo ""
      echo '```'
      print_tree "$ROOT_DIR" 3
      echo '```'
      echo ""
      if [ -n "$nodes" ]; then
        echo "## Nós / módulos"
        echo ""
        while IFS= read -r n; do
          [ -n "$n" ] || continue
          echo "- \`${n#"$ROOT_DIR"/}/\` — tipo: **$(node_type "$n")** · lang: $(or_dash "$(node_langs "$n")") · markers: $(or_dash "$(node_markers "$n")")"
        done <<< "$nodes"
        echo ""
      fi
      echo "## Comandos gerais"
      echo ""
      detect_commands "$ROOT_DIR"
      echo ""
      echo "## Fluxos principais"
      echo ""
      echo "<!-- mapeie aqui os fluxos reais: build → test → run → deploy; e como os nós se comunicam. -->"
      echo "- _(o agente preenche: pontos de entrada, ordem de build, dependências entre nós)_"
      echo ""
      openspec_block
      ;;
    service)
      echo "# AGENTS.md — service (\`${dir#"$ROOT_DIR"/}\`)"
      echo ""
      echo "- Stack: $(or_dash "$(node_langs "$dir")") · markers: $(or_dash "$(node_markers "$dir")")"
      echo ""
      detect_commands "$dir"
      echo ""
      echo "> Serviço/backend. Documente: contrato de API/porta, dependências externas (DB, filas, outros serviços), variáveis de ambiente, tratamento de erro e observabilidade."
      ;;
    app)
      echo "# AGENTS.md — app (\`${dir#"$ROOT_DIR"/}\`)"
      echo ""
      echo "- Stack: $(or_dash "$(node_langs "$dir")") · markers: $(or_dash "$(node_markers "$dir")")"
      echo ""
      detect_commands "$dir"
      echo ""
      echo "> Aplicação (UI/cliente). Documente: como consome APIs/serviços, convenções de componentes/estado, e o que NÃO deve acessar diretamente (ex.: banco/serviços internos)."
      ;;
    library)
      echo "# AGENTS.md — library (\`${dir#"$ROOT_DIR"/}\`)"
      echo ""
      echo "- Stack: $(or_dash "$(node_langs "$dir")") · markers: $(or_dash "$(node_markers "$dir")")"
      echo ""
      detect_commands "$dir"
      echo ""
      echo "> Biblioteca reutilizável. Documente: API pública/exports estáveis, política de versionamento e o que mantém compatibilidade."
      ;;
    *)
      echo "# AGENTS.md — \`${dir#"$ROOT_DIR"/}\`"
      echo ""
      echo "- Stack: $(or_dash "$(node_langs "$dir")") · markers: $(or_dash "$(node_markers "$dir")")"
      echo ""
      detect_commands "$dir"
      ;;
  esac
  echo ""
  code_conventions_block
  echo ""
  echo "$END_MARK"
  return 0
}

# scaffold de seções manuais (só em arquivo NOVO)
manual_scaffold() {
  cat <<'EOF'

<!-- Conteúdo manual abaixo — preservado entre regenerações. Preencha conforme o tipo do nó. -->

## Arquitetura

TODO: como o código é organizado (camadas/módulos/pastas-chave) e por quê.

## Convenções

TODO: regras de estilo, naming, padrões de teste deste nó.

## Fluxos & integrações

TODO: pontos de entrada, dependências externas, fronteiras com outros nós.

## Avisos

TODO: armadilhas, áreas frágeis, o que não mexer sem cuidado.
EOF
}

# ---------- escrita preservando conteúdo manual ----------
write_agents_md() {
  local dir="$1" type="$2"
  local file="$dir/AGENTS.md"
  local rel="${file#"$ROOT_DIR"/}"

  local blockfile; blockfile="$(mktemp)"; TMP_FILES+=("$blockfile")
  generated_block "$dir" "$type" > "$blockfile"

  if [ "$DRY" -eq 1 ]; then
    echo "── DRY [$type] $rel ──"
    cat "$blockfile"
    echo "──────────────────────"
    return
  fi

  # Marcadores atuais ou, num arquivo gerado pela versão anterior, os legados.
  local begin="$BEGIN_MARK" end="$END_MARK" has_block=0
  if [ -f "$file" ]; then
    if grep -qF "$BEGIN_MARK" "$file" && grep -qF "$END_MARK" "$file"; then has_block=1
    elif grep -qF "$LEGACY_BEGIN_MARK" "$file" && grep -qF "$LEGACY_END_MARK" "$file"; then
      has_block=1; begin="$LEGACY_BEGIN_MARK"; end="$LEGACY_END_MARK"
    fi
  fi

  if [ "$has_block" -eq 1 ]; then
    local tmp; tmp="$(mktemp)"; TMP_FILES+=("$tmp")
    # O conteúdo entra por arquivo, não por -v: awk interpreta escapes em -v e
    # corromperia barras invertidas vindas da árvore ou dos comandos detectados.
    awk -v b="$begin" -v e="$end" -v f="$blockfile" '
      index($0, b) { while ((getline line < f) > 0) print line; close(f); skip=1; next }
      index($0, e) { skip=0; next }
      !skip { print }
    ' "$file" > "$tmp"
    cat "$tmp" > "$file"
    echo "atualizado (bloco gerenciado): $rel"
  elif [ -f "$file" ]; then
    local tmp; tmp="$(mktemp)"; TMP_FILES+=("$tmp")
    { cat "$blockfile"; echo ""; cat "$file"; } > "$tmp"
    cat "$tmp" > "$file"
    echo "prependido bloco gerenciado (conteúdo prévio preservado): $rel"
  else
    { cat "$blockfile"; manual_scaffold; } > "$file"
    echo "criado: $rel"
  fi
}

# ---------- dispatch ----------
case "$MODE" in
  list)
    echo ">> Raiz: $ROOT_DIR"
    echo ">> Stack na raiz: $(or_dash "$(node_langs "$ROOT_DIR")")  · markers: $(or_dash "$(node_markers "$ROOT_DIR")")"
    echo ">> Nós candidatos:"
    nodes="$(discover_nodes)"
    if [ -z "$nodes" ]; then echo "   (nenhum — projeto de nó único na raiz)"; else
      while IFS= read -r n; do
        [ -n "$n" ] || continue
        echo "   - ${n#"$ROOT_DIR"/}  [tipo: $(node_type "$n")]  lang: $(or_dash "$(node_langs "$n")")  markers: $(or_dash "$(node_markers "$n")")"
      done <<< "$nodes"
    fi
    ;;
  tree)
    target="${NODE_ARG:-$ROOT_DIR}"; [ -d "$target" ] || target="$ROOT_DIR/$NODE_ARG"
    [ -d "$target" ] || { echo "ERRO: dir não existe: $NODE_ARG" >&2; exit 1; }
    print_tree "$(cd "$target" && pwd)" "${DEPTH}"
    ;;
  detect)
    target="$NODE_ARG"; [ -d "$target" ] || target="$ROOT_DIR/$NODE_ARG"
    [ -d "$target" ] || { echo "ERRO: dir não existe: $NODE_ARG" >&2; exit 1; }
    target="$(cd "$target" && pwd)"
    echo ">> $target  [tipo: $(node_type "$target")]  lang: $(or_dash "$(node_langs "$target")")"
    echo ">> markers: $(or_dash "$(node_markers "$target")")"
    echo ">> árvore:"
    print_tree "$target" 2
    echo ""
    detect_commands "$target"
    ;;
  root)
    write_agents_md "$ROOT_DIR" "${FORCE_TYPE:-root}"
    ;;
  node)
    target="$NODE_ARG"; [ -d "$target" ] || target="$ROOT_DIR/$NODE_ARG"
    [ -d "$target" ] || { echo "ERRO: dir não existe: $NODE_ARG" >&2; exit 1; }
    target="$(cd "$target" && pwd)"
    write_agents_md "$target" "${FORCE_TYPE:-$(node_type "$target")}"
    ;;
  all)
    write_agents_md "$ROOT_DIR" "root"
    nodes="$(discover_nodes)"
    while IFS= read -r n; do
      [ -n "$n" ] || continue
      write_agents_md "$n" "${FORCE_TYPE:-$(node_type "$n")}"
    done <<< "$nodes"
    ;;
esac
