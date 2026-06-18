---
description: Install deps if needed, then start the dev server in the background.
---

Run `./setup.sh` first — it installs `node_modules/` if missing (~30s) and fetches the `@parity/product-sdk` skills into `.claude/skills/` so the SDK guidance is on hand for AI assistants (alongside the tutorial's own level guides). Show the user the tail of the output. Then start `npm run dev` in the background and tell the user the URL it's serving (typically http://localhost:5173).

Remind them:
- The app must be opened inside a **Polkadot host** (Mobile, Desktop, or Web) for Host API login to work; signing is approved on Polkadot Mobile. A plain browser falls back to dev accounts (Alice, Bob, …) — fine for Level 1 UI work, not for host signing.
- The dev server runs in this Claude Code session — it stops when the session ends. For a persistent server, tell them to run `npm run dev` in their own terminal.
