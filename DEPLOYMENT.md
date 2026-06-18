# Deploying your own copy of this app

This guide walks you through deploying your own instance of the tutorial
app: your own frontend on Bulletin Chain, your own `.dot` name, starting
from nothing but a GitHub account, a terminal, and a phone. Unlike the
other playground sample apps there is **no smart contract to deploy**;
this app doesn't use one, so the whole flow is a single tool:

- **Playground CLI** (`playground`, short alias `pg`) deploys the app's
  *frontend* to Bulletin Chain, registers your `.dot` name, and publishes
  the app to the playground registry so it shows up in the Apps grid.

Rough time: 15 minutes end to end. The slow part is the CLI's first-time
toolchain install.

## 0. Prerequisites

You need two things installed:

**The Polkadot App on your phone**, with an account created. The standard
flow signs every deploy step by approving on the phone. (Deploying with a
pre-provisioned mnemonic instead is covered in step 3.)

**The Playground CLI**:

```sh
curl -fsSL https://raw.githubusercontent.com/paritytech/playground-cli/main/install.sh | bash
```

Open a fresh terminal afterwards so it's on your PATH, then verify:

```sh
playground --version
```

## 1. Fork and clone the repository

Fork this repo on GitHub (the **Fork** button), then clone **your fork**,
not the upstream repo:

```sh
git clone https://github.com/<your-github-username>/playground-tutorial.git
cd playground-tutorial
```

*What's happening:* you now own a copy of the app (the frontend in `src/`
plus the tutorial's level manifest, `quests.json`).

The fork matters beyond etiquette. When you later deploy with
`--playground`, the CLI publishes your git `origin` URL as the app's public
source repo; that's what makes your app **moddable** (others can build on
it). If you clone the upstream repo directly, your app would advertise the
original author's code instead of yours.

## 2. Sign in with the Playground CLI

```sh
playground init
```

*What's happening:* `init` checks and installs prerequisites, asks you for
a display name, then shows a QR code. Scan it with the Polkadot App and
approve: one signature on the phone. That authenticates you via Proof of
Personhood, pairs a product account (you'll see an address like
`playground.dot/0`), provisions a local session key, and confirms
allowances and funding.

There is **no `playground login` subcommand**; login is part of `init`.
Sign out later with `playground logout`.

A warning like `[cloudStorage] checkAuthorization: query failed ...
DisjointError` *after* `✓ setup complete` has been observed and was
harmless. If you got the `setup complete` line, proceed.

## 3. Deploy the frontend to the playground

```sh
playground deploy --playground --moddable --domain mytutorial01 --signer phone
```

Pick any name you like, following this repo's naming convention (see the
README): **9 or more characters, ending in exactly 2 digits**, e.g.
`mytutorial01`. If the name is already taken by someone else, pick
another.

The CLI shows a **preflight summary** before submitting anything. Read it
before pressing Enter:

- `moddable: yes ... <repo url>` must point at **your fork**. It's
  auto-detected from your git `origin`; if it shows the upstream repo, you
  cloned instead of forking. Fix with
  `git remote set-url origin https://github.com/<you>/playground-tutorial.git`.
- It lists the **4 expected phone approvals**: reserve domain (DotNS
  commitment), finalize domain (DotNS register), link content
  (setContenthash), publish to Playground registry, plus possibly one more
  to top up the Bulletin storage allowance.

Press Enter, keep your phone unlocked, and approve each signature as it
arrives. Between the first two approvals there is a deliberate ~60-second
pause (DotNS's anti-front-running window); it's not stuck.

*What's happening:*

1. builds the frontend, then uploads the assets + app metadata to
   **Bulletin Chain** (decentralized storage, no server anywhere),
2. registers your **`.dot` domain** via DotNS and points it at the upload,
3. publishes the app to the **playground registry**, which puts it in the
   playground's Apps grid and awards your account its deploy XP,
4. prints the result: your live URL (`https://<name>.dot.li`, or
   `<name>.dot` inside a Polkadot host) plus the app, IPFS, and
   metadata CIDs.

### Deploying with a mnemonic instead of the phone

If you have a pre-provisioned account (a mnemonic or secret URI) you can
skip the phone flow entirely, including `playground init`:

```sh
playground deploy --playground --moddable --domain mytutorial01 --signer dev --suri "<your secret URI>"
```

Everything (storage, DotNS, playground publish) is then signed by that
account, with no phone approvals. Two things to know:

- **Always pass `--suri`.** Bare `--signer dev` without it falls back to a
  shared, publicly-known development mnemonic, so anyone could control what
  you deploy.
- The account must be funded like any other: PAS for fees
  (<https://faucet.polkadot.io/?parachain=1500>) and a Bulletin storage
  allowance
  (<https://paritytech.github.io/polkadot-bulletin-chain/authorizations?tab=faucet>,
  the **Faucet** tab: paste your address, submit).

## 4. Verify

- Open `https://<name>.dot.li`: your app, served from Bulletin. Use a real
  browser; fetching the URL with curl/scripts returns the gateway's
  client-side resolver shell, not your HTML.
- Open the playground's **Apps** tab (the playground app inside a Polkadot
  host). Your card should appear, newest first.
- Check the playground's **Leaderboard**: your account earned its deploy
  XP.
- Play a round of Rock Paper Scissors in your instance.

## Troubleshooting

All of these were hit for real while writing this guide.

| Symptom | Cause / fix |
|---|---|
| `error: unknown command 'login'` | login is `playground init` in current CLI versions |
| `[cloudStorage] ... DisjointError` after `playground init` | observed as harmless when it appears after `✓ setup complete`; proceed |
| `Domain <name>.dot is already registered` | first come, first served; pick a different name (re-deploying a domain you own yourself is fine) |
| `<name>.dot requires ProofOfPersonhoodFull, but this signer is NoStatus` | the name is too short to be open to all accounts; pick a longer one (9+ characters) |
| Preflight shows `moddable: ... github.com/paritytech/...` | your git `origin` is the upstream repo, not your fork; `git remote set-url origin <your fork URL>` |
| Deploy pauses ~60s after the first phone approval | DotNS's mandatory commit-reveal wait (front-running protection), not a hang |
| App loads but shows no data in a plain desktop browser | expected: chain/storage access flows through the host. Open it inside a Polkadot host — its `.dot.li` URL in a browser, or the Polkadot Desktop/Mobile app |
| `.dot.li` URL returns a generic Polkadot page to curl/scripts | the gateway serves a client-side resolver shell; only a real browser renders your app |
