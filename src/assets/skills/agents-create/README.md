# agents-create

Skill default do mio que cria/atualiza `AGENTS.md` em qualquer projeto —
monorepo ou módulo único, em qualquer linguagem. Detecta a stack pelos
manifests em runtime, desenha a árvore de pastas, extrai comandos reais de
build/test/run e deixa o esqueleto de fluxos para o agente preencher.

Invocação: `/mio:agents-create` (ou peça "gerar AGENTS.md").

## Usage

- `SKILL.md` — regras de escopo, passo a passo e responsabilidades do agente.
- `scripts/agents-md.sh` — detecção e escrita (`--list`, `--tree`, `--detect`,
  `--root`, `--node`, `--all`, `--dry-run`).
- `references/templates.md` — detalhes de detecção, tipos de nó e templates.
