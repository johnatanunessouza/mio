---
"mio-cli": minor
---

Install bundled skills and their `mio:` slash commands during `mio init`.

`mio init` now ships a default skill catalog into every selected agent, independent
of the tool selection, and writes one slash command per skill entry point in the
layout each agent expects (`.claude/commands/mio/<name>.md`,
`.github/prompts/mio-<name>.prompt.md`, `<skillsDir>/commands/mio/<name>.md`).

The first bundled skill is `agents-create` (`/mio:agents-create`): it creates and
refreshes `AGENTS.md` files across a repository — detecting the stack from the
manifests found at runtime, drawing the directory tree and extracting real
build/test/run commands, while preserving any content outside its managed block.

Also adds `mio skill list` and `mio skill install`, and `mio init --skills <ids|none>`.

Adds an always-on instructions layer: `mio init` merges bundled instruction documents
into the file each agent loads every session (`AGENTS.md` by default; `CLAUDE.md`,
`GEMINI.md` and `.github/copilot-instructions.md` for the agents that declare their
own), inside a `<!-- BEGIN MIO: <id> -->` block that leaves the rest of the file
untouched. The first document is `response-protocol`. Adds `mio instructions list`,
`mio instructions install [--global]` and `mio init --instructions <ids|none>`.

The generated `AGENTS.md` now always carries a mandatory "Convenções de código"
section forbidding comments and embedded documentation (JSDoc, Javadoc, docstrings,
`@param`/`@return`) in code the agent writes.
