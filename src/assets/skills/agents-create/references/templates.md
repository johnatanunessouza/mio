# Referência — mio:agents-create

Detalhes de detecção agnóstica, tipos de nó, mapeamento de árvore/fluxos, templates
e o modelo de preservação de conteúdo. Alinha com padrões de mercado do AGENTS.md
(https://agents.md): um arquivo Markdown com instruções operacionais para agentes,
na raiz e/ou por subprojeto, com comandos de build/test reais.

## Detecção de nós (agnóstica de linguagem)

`agents-md.sh` varre níveis 1–`--depth` (default 2) a partir da raiz do repo (raiz
detectada por `.git`, `openspec/` ou `.agents/skills/`). Ignora ruído de build/IDE:
`node_modules`, `.git`, `dist`, `build`, `target`, `out`, `.next`, `.nuxt`, `.venv`,
`venv`, `vendor`, `obj`, `coverage`, `.terraform`, `.gradle`, `.idea`, `.vscode`, e os
diretórios que os próprios agentes mantêm no repo (`.agents`, `.claude`, `.codex`,
`.cursor`, `.github`, `.codegraph`, …). `bin/` **não** é ignorado: em muitos projetos
é código real.

Um diretório vira **nó** se tiver pelo menos um manifest de projeto:

| Ecossistema | Marcadores |
|---|---|
| JS/TS | `package.json`, `deno.json`, `bun.lockb` |
| JVM | `pom.xml`, `build.gradle[.kts]` |
| Python | `pyproject.toml`, `setup.py`, `requirements.txt` |
| Go / Rust | `go.mod`, `Cargo.toml` |
| PHP / Ruby | `composer.json`, `Gemfile` |
| Elixir / Dart | `mix.exs`, `pubspec.yaml` |
| .NET | `*.csproj`, `*.sln` |
| Orquestração | `Makefile`, `Taskfile.yml`, `justfile`, `docker-compose.y[a]ml`, `Dockerfile` |

> 1 nó (na raiz) → projeto de módulo único. Vários nós → monorepo. Isso decide a
> seção "Tipo de projeto" no AGENTS.md raiz.

## Heurística de tipo (agnóstica)

Classificação **por manifest, não por nome** (`--type` força quando errar):

| Tipo | Como é detectado |
|---|---|
| `app` | `package.json` com framework de UI (react/vue/svelte/angular/vite/next/nuxt/expo/react-native/electron) ou Flutter |
| `service` | tem `Dockerfile`/compose, framework de servidor (express/fastify/nest/koa/hapi), ou manifest de backend (JVM/Go/Python/Rust/PHP/Ruby/Elixir) |
| `library` | `package.json` sem UI/servidor (pacote publicável) |
| `generic` | tem manifest mas nenhuma regra acima |

## Detecção de linguagem

`node_langs()` mapeia manifests → linguagens, podendo retornar várias (poliglota):
TypeScript/JavaScript, JVM(Java/Kotlin), Python, Go, Rust, PHP, Ruby, Elixir,
Dart/Flutter, .NET/C#, Deno/TS.

## Mapeamento da árvore de pastas

`--tree [dir]` (e a seção "Estrutura do repositório" no template raiz) desenham a
árvore de **diretórios** até a profundidade dada. Usa `tree -d` se instalado; senão,
um fallback portátil com `find` + indentação. Sempre respeita a lista de prune, então
a árvore reflete a arquitetura real sem `node_modules`/`target`/etc.

## Detecção de comandos

Por nó, extrai comandos reais (sem inventar):

- **JS/TS**: detecta o package manager pelo lockfile (`pnpm`/`yarn`/`bun`/`npm`),
  lista os scripts de `package.json` (parser JSON real via node/python3; fallback awk).
- **JVM**: `mvn -B clean package` / `mvn -B test`; `./gradlew build` / `test`.
- **Python**: instalar/testar conforme tool (poetry/uv/pip + pytest) — `verify before running`.
- **Go**: `go build ./...` · `go test ./...` · `go run .`.
- **Rust**: `cargo build` · `cargo test` · `cargo run`.
- **PHP/Ruby/.NET/Elixir/Dart**: comandos padrão do ecossistema (alguns `verify before running`).
- **Make/Task/just**: lista targets/tasks.
- **Docker/Compose**: `docker compose up -d` / `build`, `docker build` — `verify before running`.

Comandos incertos saem com `_(verify before running)_`. O agente confirma antes de
documentar como definitivos.

## Mapeamento de fluxos (feito pelo agente)

O script **não** infere fluxos — deixa um placeholder na seção "Fluxos principais".
O agente preenche lendo:
- ordem de build / dependências entre nós (workspaces, `depends_on`, módulos Maven/Gradle, `replace` no go.mod);
- pontos de entrada (`main`/`index`/`cmd/`, `Dockerfile CMD`, `scripts.start`/`dev`);
- comunicação entre nós (portas/HTTP, filas, imports, contratos);
- ciclo dev→build→test→deploy (CI em `.github/workflows`, `.gitlab-ci.yml`, etc.).

## Preservação de conteúdo (bloco gerenciado)

```
<!-- BEGIN GENERATED: mio:agents-create -->
... regenerável ...
<!-- END GENERATED: mio:agents-create -->
```

| Estado do arquivo | Ação |
|---|---|
| não existe | cria com bloco gerenciado + scaffold de seções manuais |
| existe COM marcadores | substitui **só** o bloco; resto intacto (marcadores legados `generate-agents-md` também são reconhecidos e migrados) |
| existe SEM marcadores | prepende o bloco; conteúdo prévio 100% preservado |

Regeneração nunca apaga texto manual — só atualiza estrutura/árvore/comandos.

## OpenSpec (opcional)

A seção "Workflow OpenSpec" só entra no AGENTS.md raiz se o CLI `openspec` existir
**e** houver `openspec/`. Caso contrário é omitida.

## Exemplos

```bash
# diagnosticar
bash <dir-da-skill>/scripts/agents-md.sh --list
bash <dir-da-skill>/scripts/agents-md.sh --tree
bash <dir-da-skill>/scripts/agents-md.sh --detect services/api

# gerar conforme a orientação do usuário
bash <dir-da-skill>/scripts/agents-md.sh --root
bash <dir-da-skill>/scripts/agents-md.sh --node packages/web --type app
bash <dir-da-skill>/scripts/agents-md.sh --all --dry-run     # revisar antes
bash <dir-da-skill>/scripts/agents-md.sh --all               # aplicar
bash <dir-da-skill>/scripts/agents-md.sh --all --depth 3     # monorepos mais profundos
```

## Depois de rodar o script

O script monta o **esqueleto** (tipo de projeto + árvore + nós + comandos +
placeholder de fluxos). O agente deve **preencher as seções manuais** com conteúdo
real e conciso conforme o `SKILL.md`: arquitetura, convenções, fluxos reais,
fronteiras entre nós, avisos e segurança. Não copiar specs/logs longos; resumir
regras e caminhos estáveis.
