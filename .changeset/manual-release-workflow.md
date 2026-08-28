---
"mio-cli": patch
---

Ship the CLI as an installable artifact through a manually dispatched GitHub Release.

The new `Release` workflow runs only from the Actions tab. It lints, builds and
tests, consumes the pending changesets to bump the version, packs the tarball,
installs that tarball from outside the repository to prove the shipped binary runs,
then commits the bump, tags it and publishes the tarball as a Release asset whose
notes carry the install command. A `dry_run` input stops before any of the writes and
attaches the tarball to the workflow run instead.

No registry is involved. Each release carries two copies of the same tarball: a
versioned one for `npx`, and a version-less `mio-cli.tgz` so that
`npm install -g <repo>/releases/latest/download/mio-cli.tgz` always resolves to the
newest release and upgrades on re-run.
The package metadata now points at the real repository, and the repository finally
has a `.gitignore`.
