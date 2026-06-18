# Playground Tutorial — Rock Paper Scissors

> [!WARNING]
> The following is a prototype, reference implementation, and proof-of-concept. This open source code is provided for research, experimentation, and developer education only. This code has not been audited, is actively experimental, and may contain bugs, vulnerabilities, or incomplete features. Use at your own risk.

A guided, hands-on tutorial that takes a plain web app and turns it into a full on-chain product on Polkadot, one step at a time. You start with a local Rock Paper Scissors game and unlock a new layer of the stack at each level.

You stay on `main` the whole time — every level builds on top of the previous one in the same working tree. No branch hopping, no separate checkouts.

## How to start

```bash
playground mod playground-tutorial
# or, using the short alias:
pg mod playground-tutorial
```

`playground` and `pg` are interchangeable — `pg` is just the short alias. We use `pg` from here on.

The CLI shows you the level picker, clones the repo, and drops you into the project. From there, follow the level you're on — Claude picks up the right context for each step automatically.

> **Domain naming:** your `.dot` name must be **9 or more characters** and end in **exactly 2 digits** — e.g. `myappname01`, `rockpaper42`.

## Prerequisites

- **A laptop** — you'll need a computer; the tutorial isn't designed for mobile.
- A funded account, depending on how far you go:
  - Level 1: nothing — everything is local.
  - Level 2+: PAS tokens on **Bulletin** — [faucet](https://faucet.polkadot.io/?parachain=1501).
  - Level 3+: PAS tokens on **Asset Hub** as well — [faucet](https://faucet.polkadot.io/?parachain=1500). Same account on both chains.
- Level 3 only: `rustup` and the `cdm` CLI.

## Levels

### Level 1 — Local Challenger _(~15 min, ★)_

The starting point. Sign in, play best-of-3 vs. the computer, results saved on your device. Make it yours: mod the UI (theming, emoji sets), tweak the computer's behavior (personality, trash-talk, sound effects), or **change the game entirely** — swap rock-paper-scissors for tic-tac-toe, battleship, chess, anything you want. Whatever you build, ship it to your `.dot` domain with `pg deploy`. No contracts, no chain — just product.

### Level 2 — On-Chain Record _(~20 min, ★★)_

Move your game history off the device and onto Bulletin Chain. Each result is uploaded as content-addressed JSON and your profile rehydrates from there on reload — so your history follows your account across machines.

### Level 3 — The Leaderboard _(~25 min, ★★★)_

Deploy your own Rust smart contract and use it as a public leaderboard. The contract indexes players and their scores; game data itself stays on Bulletin. Anyone can look up any player's history through the leaderboard UI.

### Level 4 — Multiplayer _(~30 min, ★★★★)_

Real PvP. Create a room, share a link or QR code, opponent joins, you play live with commit-reveal anti-cheat so neither side can peek at the other's move. Both players' leaderboard entries update at the end.

## Tech Stack (by level)

| Layer            | Introduced in | Technology                          |
| ---------------- | ------------- | ----------------------------------- |
| UI               | Level 1       | React 19 + Vite + TypeScript        |
| Wallet           | Level 1       | Product SDK (host-managed account)  |
| Hosting          | Level 1       | `pg deploy` → Bulletin + DotNS     |
| Off-chain store  | Level 2       | Bulletin Chain (content-addressed)  |
| Smart contract   | Level 3       | `cdm` + PVM (Rust) on Asset Hub     |
| Live multiplayer | Level 4       | Statement Store (commit-reveal)     |

## Running locally

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173`. Open it inside a Polkadot host — `dot.li` in your browser, or the Polkadot Desktop app.

> Deploying **your own copy** (own `.dot` name, published to the playground)?
> Follow the step-by-step [DEPLOYMENT.md](./DEPLOYMENT.md). This app has no
> smart contract, so it's the short version of the flow.

## Structure

```
quests.json                  # Level manifest
docs/levels/                 # Per-level AI context (00-overview + level-1..4)
.claude/skills/              # Fetched @parity/product-sdk skills (gitignored)
src/
├── App.tsx                  # Routing + account selector
├── utils.ts                 # Account flow, helpers
├── types.ts                 # Move, Round, GameData, PlayerData
└── pages/
    ├── Home.tsx             # Mode picker + profile
    ├── MyProfile.tsx        # Stats + history
    └── SoloGame.tsx         # Solo match vs computer
```

As you progress through the levels, you'll add `contracts/leaderboard/` and `cdm.json` (Level 3), and multiplayer pages (Level 4).

## Security

This is a reference proof-of-concept, **not a hardened production build**. Before
deploying it for any real use case, you are responsible for:

- Reviewing the code yourself.
- Checking that dependencies are up to date and free of known vulnerabilities.
- Securing your own fork or deployment environment (keys, secrets, network configuration).
- Tracking the latest tagged release / commits for security fixes — older releases
  are not backported (exceptions might apply).

For Parity's security disclosure process and Bug Bounty program, see
[parity.io/bug-bounty](https://parity.io/bug-bounty).

## Licence

Licensed under the [GNU General Public License v3.0](./LICENSE) (GPL-3.0-only).
