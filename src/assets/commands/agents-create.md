Crie ou atualize os arquivos `AGENTS.md` deste projeto usando a skill **agents-create**.

**Entrada**: o argumento depois de `/mio:agents-create` é o escopo. Aceite qualquer
uma destas formas (ou nada):

| Argumento | Escopo |
|---|---|
| _(vazio)_ | diagnostique primeiro e **pergunte** o escopo |
| `list` | só lista os nós detectados e a stack de cada um; não escreve nada |
| `root` | gera/atualiza apenas o `AGENTS.md` da raiz |
| `<caminho>` | gera/atualiza o `AGENTS.md` dentro de `<caminho>/` |
| `all` | gera/atualiza na raiz **e** em cada nó detectado |

**Passos**

1. **Carregue a skill `agents-create`** e siga as regras dela. Ela fica no diretório de
   skills deste agente (ex.: `.claude/skills/agents-create/`, `.agents/skills/agents-create/`,
   `.github/skills/agents-create/`) e traz `scripts/agents-md.sh` ao lado do `SKILL.md`.

2. **Diagnostique antes de escrever**, a partir da raiz do projeto:

   ```bash
   bash <dir-da-skill>/scripts/agents-md.sh --list
   ```

   Isso mostra se é monorepo ou módulo único, e o tipo/stack de cada nó.

3. **Confirme o escopo com o usuário** se ele não veio no argumento. Nunca assuma `all` —
   gerar `AGENTS.md` em todos os nós de um monorepo é uma mudança ampla.

4. **Gere** com o escopo escolhido (`--root`, `--node <caminho>` ou `--all`). Use
   `--dry-run` primeiro quando o escopo for amplo ou o projeto já tiver `AGENTS.md`.

5. **Preencha o conteúdo que o script não infere.** O script monta o bloco gerenciado
   (tipo de projeto, árvore, nós, comandos detectados); você escreve os **fluxos reais**
   e as seções manuais lendo manifests, Dockerfiles e CI: ordem de build, pontos de
   entrada, comunicação entre nós, ciclo dev→deploy.

6. **Relate** quais arquivos foram criados/atualizados e o que ficou marcado como
   `verify before running`.

**Regras**

- `AGENTS.md` é o formato comum a todos os agentes — um arquivo por nó serve todos eles.
- Nunca invente comandos ou arquitetura: só o que foi detectado nos manifests e na árvore.
- Só o conteúdo entre `<!-- BEGIN GENERATED: mio:agents-create -->` e `<!-- END GENERATED: ... -->`
  é reescrito. Nunca edite fora do bloco para "arrumar" — isso é território do usuário.
- Blocos `<!-- BEGIN MIO: ... -->` são do `mio init` (instruções sempre ativas). Não mexa.
- O bloco gerado inclui a seção "Convenções de código (obrigatório)", que proíbe
  comentários e documentação embutida no código. Não remova essa seção, e siga a regra
  ao escrever código neste projeto.
- Seja conciso: instrução operacional, não documentação extensa.
