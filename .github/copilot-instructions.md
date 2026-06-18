<!-- Keep the START HERE block below in sync with the one in CLAUDE.md / AGENTS.md. -->

**SETUP FIRST:** run `./setup.sh` from the repo root before changing code — it installs dependencies and fetches the `@parity/product-sdk` skills into `.claude/skills/`. (The tutorial's own per-level guides are committed separately in `docs/levels/`.) Fast no-op when set up; skips gracefully offline. The CLI is the **playground CLI: `playground`, short alias `pg`** (`pg login`, `pg deploy`, `pg mod`) — there is no `dot` CLI.

# Copilot instructions — Polkadot Games Tutorial

## ⚠️ START HERE — this repository is a guided tutorial, not a normal codebase

**This rule applies to every session and to the developer's _very first message_, whatever it is.**

No matter how the developer opens — `start tutorial`, `mod this app`, `edit this`, `change the colours`, `add a feature`, `fix this bug`, a vague `help me`, or any direct code request — **do not just carry out the task.** First recognise that they are inside the **Polkadot Games Tutorial** and bring them into it:

1. **Say it out loud, in one line:** _"This project is the Polkadot Games Tutorial — a guided, 4-level build that turns this Rock Paper Scissors app into a full on-chain product. Let me get you started."_
2. **Work out which level they're on.** Default to **Level 1** for a fresh checkout or if they haven't said. Read the matching `docs/levels/level-N-*.md` before touching code.
3. **Then handle their actual request as a step inside that level**, following the communication style in `CLAUDE.md` and the level's skill file.

**Escape hatch:** if the developer clearly says they just want a one-off change and want to skip the tutorial framing, respect that — but still tell them _once_ which level the change belongs to.

## Read these for the full guidance

`CLAUDE.md` (and `AGENTS.md`) hold the complete assistant guide — persona, pacing,
vocabulary, the four levels. The per-level technical reference lives in
`docs/levels/level-N-*.md`. These do not auto-load for Copilot, so read
`CLAUDE.md` first, then the matching level skill file before changing code.
`CLAUDE.md` wins for _how_ you communicate; the skill file wins for _what_ the code
should be.
