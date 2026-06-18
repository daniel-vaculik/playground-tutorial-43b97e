# Deploying `playground-tutorial.dot` to Summit

This repo is the canonical **seed** copy of the Rock Paper Scissors tutorial. The
official instance lives at **`playground-tutorial.dot`** on the Web3 Summit
network and is what attendees discover in the playground Apps grid and clone with
`playground mod playground-tutorial.dot`.

Deployment is automated by [`.github/workflows/deploy-summit.yml`](./workflows/deploy-summit.yml).
This document is the operator reference for the bits that aren't obvious from the YAML.

## What the workflow does

One run, three legs (the single-app `playground deploy` command runs headless when
all of `--signer/--domain/--buildDir/--playground/--contracts` are specified):

1. **Build** the Vite SPA → `dist/` (relative `base`, so it works from a Bulletin/IPFS gateway).
2. **Host + bind** — upload `dist/` to Summit Bulletin and point DotNS
   `playground-tutorial.dot` at it (`setContenthash`).
3. **Publish (moddable)** — write the app into the `@w3s/playground-registry` with
   `repository = this repo` + the inlined README, so it appears in the Apps grid
   and `playground mod` can fetch the source.

## Required secret

| Secret | Value | Why |
|---|---|---|
| `MNEMONIC` | the canonical PCF deployer **`5Fk8…`** mnemonic | It is **Bulletin-authorized** on Summit (uploads are feeless but authorization-gated), owns `playground-tutorial.dot`, and is the **playground-registry sudo** (so it may `publish`). The same account deploys `playground.dot` and the other PCF Summit apps. |

`--signer dev --suri "$MNEMONIC"` signs everything with that account — no phone, no
`playground login`. (Bare `--signer dev` without `--suri` would fall back to a
public dev mnemonic; the workflow always passes `--suri`.)

## Triggers

- **`workflow_dispatch`** — run the **first (greenfield) deploy** this way so it can
  be watched; it registers the DotNS name (~2 SUM, one-time) on top of the upload.
  The `publish` input (default `true`) can be turned off to host + bind only.
- **`push` to `main`** (app-content paths only) — day-2 redeploys. Re-deploying a
  name `5Fk8` already owns just updates the contenthash + republishes metadata
  (an upsert) — it does **not** re-register, so it stays cheap.

## Network / tooling notes

- **`--env summit`** is passed explicitly. `playground-cli`'s built-in default is
  still `paseo-next-v2`; only the per-invocation flag targets Summit.
- `playground-cli` is a **private** package (not on npm) and the public
  `paritytech` release binaries do **not** carry the Summit CDM registry. The
  workflow therefore builds the **PCF fork** (`Polkadot-Community-Foundation/playground-cli`)
  from source at a pinned commit (`PLAYGROUND_CLI_REF`). That fork pulls
  `@polkadot-community-foundation/cdm-env ≥ 2.1.0`, which resolves
  `getRegistryAddress("w3s") → 0xa5747e60ae27f93e92019e4021abfc4957050141` (the live
  Summit CDM meta-registry). A sanity step fails the run if that address is empty.
  - **Bumping the CLI:** update `PLAYGROUND_CLI_REF` to a newer fork SHA. The only
    hard requirement is that its `cdm-env` stays `≥ 2.1.0`.

## Lifecycle / upkeep

- The Bulletin upload **expires (~14 days)** like every Summit app upload — re-run
  the workflow before it lapses. See the suite's `OPS_BULLETIN_RENEWAL_RUNBOOK`.
- The Summit network is wiped at the event's closing ceremony; nothing here
  survives it.

## Manual fallback

If CI is unavailable, the same deploy from a checkout (with a Summit-built
`playground` binary on PATH):

```sh
bun run build
playground deploy \
  --env summit \
  --signer dev --suri "$MNEMONIC" \
  --domain playground-tutorial \
  --buildDir dist --no-build --no-contracts \
  --playground --moddable --tag gaming
```
