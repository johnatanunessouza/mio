---
name: agents-create
description: >-
  Gera ou atualiza arquivos AGENTS.md para QUALQUER projeto de programação —
  agnóstico de linguagem — na raiz, em um nó específico, ou em todos os nós.
  Detecta a estrutura (monorepo vs. módulo único), desenha a árvore de pastas,
  mapeia fluxos e extrai comandos reais de build/test/run dos manifests
  encontrados em runtime (package.json, pom.xml, build.gradle, go.mod,
  Cargo.toml, pyproject.toml, composer.json, Gemfile, mix.exs, Makefile,
  docker-compose, etc.). Use quando o usuário pedir para criar, gerar,
  regenerar ou sincronizar arquivos de instrução de agente. Gatilhos: 'criar
  AGENTS.md', 'gerar AGENTS.md', 'atualizar AGENTS.md', 'documentar o projeto
  para agentes', 'mio:agents-create'.
license: MIT
compatibility: >-
  Bash + ferramentas de leitura de arquivo. Sem dependências obrigatórias; usa
  `tree`, `node`, `python3`, `openspec` se presentes. Detecta JS/TS, JVM,
  Python, Go, Rust, PHP, Ruby, .NET, Elixir, Dart e orquestradores
  (Make/Task/just/Docker).
metadata:
  author: mio
  version: "2.1"
---

# Criar AGENTS.md (mio:agents-create)

Cria/atualiza arquivos `AGENTS.md` em **qualquer projeto** — monorepo ou módulo
único, em **qualquer linguagem**. A skill **descobre a stack em runtime**; nunca
assume a tecnologia. O objetivo de cada `AGENTS.md` é dar a um agente o contexto
operacional mínimo para trabalhar com segurança: **o que é o projeto, como está
organizado, quais são os fluxos e quais comandos rodar.**

`AGENTS.md` é o formato aberto que os agentes de desenvolvimento leem em comum
(https://agents.md), então um único arquivo serve todos os agentes instalados no
projeto — não escreva um arquivo por agente.

> **Princípio:** AGENTS.md é instrução operacional concisa, não documentação
> extensa. O agente **não inventa** comandos nem arquitetura — detecta dos
> manifests e da árvore real, e marca como `verify before running` o que for
> incerto.

O que esta skill faz por você:
1. **Identifica a estrutura** — monorepo (múltiplos nós) vs. módulo único.
2. **Mapeia e desenha a árvore de pastas** (arquitetura de diretórios).
3. **Detecta a stack/linguagem** de cada nó (sem hard-coding).
4. **Extrai comandos reais** de build, test, run e deploy.
5. **Prepara o esqueleto de fluxos** para o agente preencher.

---

## O script

Todos os comandos abaixo chamam `scripts/agents-md.sh`, que fica **ao lado deste
SKILL.md**, dentro do diretório da skill (ex.: `.claude/skills/agents-create/`,
`.agents/skills/agents-create/`, `.github/skills/agents-create/`).

Rode a partir da raiz do projeto, apontando o caminho da skill:

```bash
bash <dir-da-skill>/scripts/agents-md.sh --list
```

Se o script não estiver rodando na raiz certa (repos aninhados, worktrees),
passe a raiz explicitamente: `--root-dir /caminho/do/projeto`.

---

## Passo 0 — Definir o escopo POR ORIENTAÇÃO (obrigatório)

Antes de escrever qualquer arquivo, esclareça com o usuário (ou aceite via argumento):

| Orientação | Significado |
|---|---|
| `--root` / "só a raiz" | gera apenas `./AGENTS.md` |
| `--node <caminho>` / "no nó X" | gera `AGENTS.md` dentro de `<caminho>/` |
| `--all` / "todos os nós" | gera na raiz + em cada nó detectado |
| `--list` / "quais nós existem?" | só lista nós + stack, não escreve nada |

Se o usuário não especificou, **pergunte** (raiz, um nó, ou todos) — não assuma
`--all`. Rode o diagnóstico antes para mostrar o que existe:

```bash
bash <dir-da-skill>/scripts/agents-md.sh --list      # nós + stack detectada (não escreve)
bash <dir-da-skill>/scripts/agents-md.sh --tree      # só a árvore de pastas da raiz
```

---

## Passo 1 — Mapear o projeto (descoberta em runtime)

1. **Estrutura** — `--list` revela se é monorepo (vários nós) ou módulo único, e o
   tipo/linguagem de cada nó.
2. **Árvore de pastas** — `--tree [dir]` desenha a arquitetura de diretórios que vai
   para a seção "Estrutura do repositório".
3. **Stack/linguagem** — detectada por manifest, não por nome. Cobre JS/TS, JVM,
   Python, Go, Rust, PHP, Ruby, .NET, Elixir, Dart e orquestradores.
4. **Comandos reais** — `--detect <dir>` imprime stack + árvore + comandos de um nó:
   ```bash
   bash <dir-da-skill>/scripts/agents-md.sh --detect path/to/node
   ```
5. **Fluxos** — o script **não** adivinha fluxos; ele deixa um placeholder. **O agente**
   lê os manifests/Dockerfiles/CI e descreve os fluxos reais (ordem de build, como os
   nós se comunicam, entrypoints, deploy). Veja "Mapear fluxos" abaixo.
6. **OpenSpec (se existir)** — só quando há `openspec/` e o CLI `openspec`. Caso
   contrário, **siga sem ele**; a seção é omitida.

Se o projeto já tem um índice CodeGraph (`.codegraph/` na raiz), use-o para
entender entrypoints e dependências antes de escrever os fluxos — é mais rápido e
preciso que ler arquivo por arquivo.

---

## Passo 2 — Gerar/atualizar, preservando conteúdo manual

Cada `AGENTS.md` gerado usa **blocos gerenciados** delimitados por marcadores. Só o
conteúdo *entre os marcadores* é reescrito; tudo fora é preservado entre execuções:

```markdown
<!-- BEGIN GENERATED: mio:agents-create -->
... regenerável (estrutura, árvore, stack, comandos) ...
<!-- END GENERATED: mio:agents-create -->

<!-- Abaixo: conteúdo manual, preservado entre regenerações -->
```

```bash
bash <dir-da-skill>/scripts/agents-md.sh --root                 # só a raiz
bash <dir-da-skill>/scripts/agents-md.sh --node path/to/node    # um nó
bash <dir-da-skill>/scripts/agents-md.sh --all                  # raiz + todos os nós
bash <dir-da-skill>/scripts/agents-md.sh --all --dry-run        # pré-visualizar
```

O script gera o **bloco gerenciado** (estrutura + árvore + comandos) e, em arquivo
novo, um **scaffold de seções manuais**. **O agente então preenche** as seções com
conteúdo real e conciso.

Um `AGENTS.md` já existente nunca é sobrescrito: se tem os marcadores (inclusive os
da versão antiga `generate-agents-md`), só o bloco é trocado; se não tem, o bloco é
prependido e o conteúdo prévio fica intacto.

---

## Mapear fluxos (responsabilidade do agente)

O script não infere fluxos — você infere. Para a seção "Fluxos principais", olhe:

- **Ordem de build / dependências entre nós** — qual nó precisa do outro? (workspaces,
  `depends_on` no compose, módulos pai/filho no Maven/Gradle, replace no go.mod).
- **Pontos de entrada** — `main`, `index`, `cmd/`, controllers, `Dockerfile CMD`,
  `scripts.start`/`dev`.
- **Comunicação entre nós** — HTTP/portas, filas, imports diretos, contratos.
- **Ciclo dev→prod** — comando de dev, de build, de teste, de deploy (CI em
  `.github/workflows`, `.gitlab-ci.yml`, etc.).

Resuma em 3–8 bullets. Não cole logs nem specs longas.

---

## Conteúdo por tipo de nó (agnóstico)

O script classifica o nó por heurística de manifest, não por nome:

### Raiz (`./AGENTS.md`)
- Tipo de projeto (monorepo vs. módulo único) e stack.
- **Árvore de pastas** (arquitetura de diretórios).
- Lista de nós/módulos com tipo e linguagem.
- Comandos gerais e **fluxos principais**.
- Regras de arquitetura/fronteiras entre nós; segurança; OpenSpec (se aplicável).

### `service` (backend / API / worker / container)
- Stack e comandos detectados.
- Contrato/porta, dependências externas (DB, filas, outros serviços), env vars.
- Tratamento de erro e observabilidade.

### `app` (UI web / mobile / desktop)
- Stack e comandos detectados.
- Como consome serviços/APIs; convenções de componentes/estado.
- O que **não** deve acessar diretamente (ex.: banco, serviços internos).

### `library` (pacote reutilizável)
- Stack e comandos detectados.
- API pública/exports estáveis; versionamento; compatibilidade.

### `generic`
- Stack e comandos; o agente descreve o propósito.

> A heurística é um ponto de partida. Se estiver errada, force com
> `--type root|service|app|library|generic` e ajuste o texto manualmente.

---

## Convenções de código no AGENTS.md gerado

Todo bloco gerado carrega a seção **"Convenções de código (obrigatório)"**, que proíbe
comentários e documentação embutida no código (`//`, `/* */`, `#`, docstrings, JSDoc,
Javadoc, `@param`/`@return`). Isso é regra do projeto, não sugestão:

- não remova nem enfraqueça essa seção ao preencher o restante do arquivo;
- ao escrever ou alterar código neste projeto, siga a mesma regra — nomes e estrutura
  no lugar de comentários;
- comentários **já existentes** no repositório não devem ser removidos sem o usuário
  pedir. A regra rege o que você escreve, não autoriza limpeza do legado.

Se o usuário pedir explicitamente comentários em um trecho, atenda o pedido dele: a
instrução direta do usuário vence o default.

## Regras invioláveis

1. **Orientação primeiro** — nunca gere em todos os nós sem confirmação.
2. **Agnóstico** — detecte a stack em runtime; nunca assuma a linguagem/framework.
3. **Não invente** — só comandos/arquitetura detectados; incertos recebem `verify before running`.
4. **Preserve o manual** — só reescreva dentro do bloco `GENERATED`.
5. **Não toque em outros blocos gerenciados** — `<!-- BEGIN MIO: ... -->` pertence ao
   `mio init` (instruções sempre ativas, como o protocolo de resposta). Deixe intacto.
6. **OpenSpec é opcional** — degrade graciosamente quando ausente.
7. **Conciso e operacional** — sem copiar specs/logs longos; resuma regras e caminhos.

---

## Fluxo recomendado para o agente

1. `agents-md.sh --list` (+ `--tree`) e **confirme o escopo** com o usuário.
2. Mapeie: estrutura, árvore, stack e comandos (`--detect` por nó).
3. **Descreva os fluxos** lendo manifests/CI/Dockerfiles (não delegado ao script).
4. Rode `agents-md.sh` com o escopo escolhido (use `--dry-run` para revisar).
5. Preencha as seções manuais com conteúdo real e conciso.
6. Valide: cada AGENTS.md tem stack correta, árvore real, comandos reais, fluxos
   claros e nada inventado.

Detalhes de detecção, tipos de nó, templates e exemplos: `references/templates.md`.
