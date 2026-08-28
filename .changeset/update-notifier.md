---
"mio-cli": minor
---

Tell the user when a newer release exists, and how to install it.

Every run reports what the previous check found — `Update available 1.11.0 → 1.12.0`
followed by the pinned `npm install -g` command for that release — and then hands the
next lookup to a detached process. The current command never waits on the network, so
a slow or unreachable GitHub cannot delay it or make it fail. The result is cached in
`$XDG_CACHE_HOME/mio-cli/update-check.json` and refreshed at most once a day; a failed
lookup still records the attempt, so an offline machine checks once a day rather than
once per command.

The notice appears only on a terminal, so piped output stays machine-readable, and it
is silenced by `--no-update-check`, `MIO_NO_UPDATE_NOTIFIER=1`, `NO_UPDATE_NOTIFIER=1`,
or running in CI. A package whose `repository` does not point at GitHub disables it
entirely.
