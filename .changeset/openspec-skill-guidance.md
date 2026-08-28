---
"mio-cli": minor
---

Write skill-contributed guidance into a project's `openspec/config.yaml`.

A skill can now carry the rules for how an OpenSpec workflow must be run, and mio
puts them in the project's config instead of every project having to paste them in
by hand. The first entry ships with `code-review`: before a change is archived, the
agent must confirm the skill ran over the change's full diff in this session, and
run it and report the findings first if it did not.

The rules land inside a `# BEGIN MIO: openspec-guidance` block, regenerated from the
catalog on every run, so everything the user wrote outside the markers is preserved
byte-for-byte and reruns produce no diff. Both directions converge on the same file:
`mio init --tools openspec` applies the guidance of whatever contributing skills the
project already has, and `mio skills-list` applies it the moment such a skill is
installed into a project that already has OpenSpec.
