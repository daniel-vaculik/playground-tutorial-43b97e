---
title: RPS architecture & SDK — START HERE
---

# Start here (AI context overview)

Rock Paper Scissors is a **Polkadot product-SDK app** that runs inside a
**Polkadot host** — the Polkadot Desktop app, or the `dot.li` web host (iframe) in a browser. The repo on `main` is the
**Level 1 starting state**: a best-of-3 local game with host-managed accounts
via `SignerManager` and results in localStorage. Levels 2–4 (Bulletin storage,
leaderboard contract, multiplayer) are **built by the developer on top of it**,
guided by the matching `level-N-*.md` file. Do not assume code from a future
level already exists — check the source first.

The single most important source file is **`src/utils.ts`** — it owns the
`SignerManager` setup and the game helpers. `src/App.tsx` owns the connect
flow and account selection.

## SDK packages (always use the latest published versions — do NOT pin)

Install with `npm install <pkg>@latest`. The app uses the
`@parity/product-sdk-*` family. The old `@novasamatech/product-sdk` is frozen,
and `@novasamatech/host-api-wrapper` is the low-level layer that the signer and
host packages wrap — do **not** import either of them directly.

| Package | What it provides | Level |
|---|---|---|
| `@parity/product-sdk-signer` | `SignerManager`, `HostProvider`, `DevProvider`, `SignerState`; `SignerAccount` exposes `address` (SS58), `h160Address` (`0x…`), `publicKey`, `getSigner()` | 1+ |
| `@parity/product-sdk-host` | `isInsideContainerSync()` host detection; `getPreimageManager()` for host-sponsored uploads | 1+ |
| `@parity/product-sdk-cloud-storage` | `CloudStorageClient` (Bulletin upload + read), `createLazySigner`, `checkAuthorization` | 2 |
| `@parity/product-sdk-contracts` | `ContractManager`, `createContractRuntimeFromClient`, `ensureContractAccountMapped` | 3 |
| `@parity/product-sdk-descriptors` | chain descriptors (`paseo_asset_hub`, `paseo_bulletin`) | 2–3 |
| `@parity/product-sdk-statement-store` | `StatementStoreClient`, `ChannelStore` (multiplayer) | 4 |
| `@parity/product-sdk-chain-client` | `createChainClient` (Asset Hub client for the contract layer) | 3 |

## Network — Paseo Next v2 (v1 retired 2026-05-20)

- **Asset Hub Next** (contracts): `wss://paseo-asset-hub-next-rpc.polkadot.io`
- **Bulletin Next**: `wss://paseo-bulletin-next-rpc.polkadot.io`
- **IPFS gateway** (manual CID verification): `https://paseo-bulletin-next-ipfs.polkadot.io/ipfs/<cid>`
- **Cloud Storage preset**: `CloudStorageClient.create({ environment: "paseo", … })`
  (a `"summit"` preset also exists for the event network)
- **CDM registry** (flat-CDM): `0xf62c2ece29cd8df2e10040ecfa5a894a5c5d9cb0`
  — confirm against the current CDM release before a fresh deploy; it has changed
  across releases and is stored in `cdm.json` under the top-level `registry` key.

## Critical invariants (get these wrong → nothing signs or reads)

1. **Product identity is the `dotNsIdentifier` passed to `HostProvider`** —
   `PRODUCT_ID = "playground-tutorial.dot"` in `src/utils.ts`, following the
   product-sdk convention (`"<name>.dot"`). The host scopes product accounts
   and signing to this identifier, and it also feeds the statement-store
   account in Level 4. When the developer deploys their own mod to their own
   domain, update `PRODUCT_ID` to `"<their-name>.dot"` and keep it consistent
   everywhere. (Older notes said to use `window.location.host` verbatim — that
   guidance predates the `SignerManager` migration and is obsolete.)
2. **Signing is handled entirely by the signer package.** `HostProvider` with
   the `productAccount` option uses the host's product-account flow (it never
   calls the legacy `getLegacyAccounts()`) and internally pins the
   `createTransaction` signing path, which Paseo Next v2's signed extensions
   (AsPgas, AsRingAlias, …) require. Never wire a signer by hand — use
   `account.getSigner()` or `signerManager.getSigner()`.
3. **Every SS58 origin must be Revive-mapped before it touches a contract** —
   including read-only queries and the live-registry lookup. Unmapped → the
   dry-run fails with `Revive::AccountUnmapped`. Map with
   `ensureContractAccountMapped(runtime, address, signer)` (one-time signature).
4. **Contract ABI uses Solidity `address`** (not `bytes20`). Pass `0x…` H160 hex
   strings (`account.h160Address`) to the encoder; never hand-build
   `Binary`/`FixedSizeBinary`.
5. **Contract resolves live from the registry** (`ContractManager.fromLiveClient`),
   not from the cdm.json snapshot — so a redeploy is picked up without a new
   cdm.json. The lookup is a contract query, hence invariant #3.

## Connect flow & dev fallback

`App.tsx` connects on mount with
`signerManager.connect(isInsideContainerSync() ? "host" : "dev")` and
auto-selects the first account. Outside a host, `DevProvider` supplies the
standard dev accounts (Alice, Bob, …) so the game runs in a plain browser for
local UI work — but everything host-backed (product-account signing, Bulletin
reads through the host, Statement Store) needs Polkadot Desktop. Game pages
render only with a selected account.
