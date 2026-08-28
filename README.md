# mio

`mio` is a deliberately small Node.js CLI foundation. It provides standard help and
version handling plus a local, extensible agent-configuration flow. It does not
model specs, changes, schemas, planning workflows, telemetry, upgrades, or remote
skill installation.

## Install and run

```sh
pnpm install
pnpm build
node bin/mio.js --help
node bin/mio.js init
node bin/mio.js init ./my-project --agents codex,claude
node bin/mio.js agent list
node bin/mio.js agent configure . --agents codex,claude
```

`mio init` restores the visual onboarding flow and opens an interactive multi-select
list of supported agents. Use `--agents` for CI and other non-interactive terminals.

## Skills and commands

`mio init` installs the bundled default skills into every selected agent, whatever
tools were chosen. Each skill ships as a directory under the agent's skills folder
(`.claude/skills/<id>/`, `.agents/skills/<id>/`, `.github/skills/<id>/`, …) plus one
slash command per entry point, namespaced under `mio`:

| Skill | Command | What it does |
|---|---|---|
| `agents-create` | `/mio:agents-create` | Create or refresh `AGENTS.md` across the repo — detects the stack from the manifests, draws the directory tree and extracts real build/test commands |

```sh
node bin/mio.js skill list                        # bundled skills and their commands
node bin/mio.js skill install . --agents claude   # install without a full init
node bin/mio.js init . --skills none              # init without any skill
```

Agents whose command directory is flat get a prefixed file instead of a namespaced
one — GitHub Copilot reads `/mio-agents-create` from
`.github/prompts/mio-agents-create.prompt.md`. `mio init` prints the exact invocation
for each agent it configured.

The catalog lives in `src/core/skills/registry.ts` and the bundles in
`src/assets/skills/`; per-agent command layout is described by `commandsDir`,
`commandStyle` and `commandExtension` in `src/core/agents/registry.ts`.

## Always-on instructions

Skills are invoked; instructions are always in context. `mio init` merges every
default instruction document into the file each selected agent loads at the start of
a session, inside a managed block:

```markdown
<!-- BEGIN MIO: response-protocol -->
...
<!-- END MIO: response-protocol -->
```

Only that block is rewritten, so the rest of the file — including the block
`mio:agents-create` generates in `AGENTS.md` — is preserved. `AGENTS.md` is the
default target because most agents read it; Claude Code (`CLAUDE.md`), Gemini CLI
(`GEMINI.md`) and GitHub Copilot (`.github/copilot-instructions.md`) declare their own.

| Instruction | What it does |
|---|---|
| `response-protocol` | Dense, indexable final answers: `STATUS` / `RESUMO` / `ARQUIVOS` / `DECISOES` / `RISCOS` / `PROXIMA_ACAO` |

```sh
node bin/mio.js instructions list
node bin/mio.js instructions install . --agents claude
node bin/mio.js instructions install --agents claude --global   # writes ~/.claude/CLAUDE.md
node bin/mio.js init . --instructions none
```

Use `--global` for a policy that should follow you across every project instead of
being committed to one repository.

Both `init` and `agent configure` validate every supplied identifier before writing
any file. They create one deterministic local fixture per selected target, so repeated
runs do not duplicate content. Use `--global` only for targets that declare a global root.

## Development

```sh
pnpm build
pnpm lint
pnpm test
pnpm pack --dry-run
```

The catalog lives in `src/core/agents/registry.ts`; target paths are isolated in
`src/core/agents/paths.ts`. The `skills/` and `.agents/skills/` directories are
neutral extension boundaries for future local functionality, not distributable
OpenSpec workflow payloads.

## Attribution

This repository is derived from OpenSpec. The MIT license and history are retained
for attribution; the legacy OpenSpec runtime and workflow content are not shipped.
