---
quest: level-3
title: The Leaderboard — AI context
---

# Context for Claude / AI pair

You are helping a developer complete **Level 3: The Leaderboard**.

Read [00-overview.md](00-overview.md) first — it covers the SDK package set,
the network, the registry, and the five critical invariants. This file is the
contract + deploy specifics.

## Goal

Deploy a Rust/PVM contract on **Paseo Asset Hub Next** that indexes players by
address. The contract stores `(cid, points)` per player; the game JSON itself
stays on Bulletin (Level 2). The contract is the index; Bulletin is the data.

## How it builds and deploys — it's all `pg deploy`

**There is no separate contract account, no mnemonic to import, and no faucet.**
The contract is built, deployed, and registered as part of the same `pg deploy`
the developer runs to ship every level.

- **The toolchain is already installed.** `pg login` installs the full Rust
  toolchain (rustup, nightly, rust-src) and `cargo-pvm-contract` (pinned to a
  `main` commit by the CLI). Never run `cargo install` by hand or pin an SDK
  branch — if a tool is missing, the fix is `pg login`, not a manual install.
- **The product account signs everything.** `pg deploy` builds the contract,
  deploys it to Asset Hub, publishes its metadata to Bulletin, and registers
  the package — all signed by the developer's host-managed product account, the
  same account their app uses at runtime. There is no `~/.cdm/accounts.json`
  and no `cdm account set`.
- **No funding step.** The active network uses allowances, not a faucet. There
  is no "grab test tokens" step; a payment-related deploy failure is an
  allowance/authorization issue, not a faucet trip.
- **Mapping is automatic.** Revive maps the account on its first transaction —
  the developer never runs `cdm account map`.

When the contract is ready, deploy is simply:

```sh
pg deploy        # answers "did your contracts change?" → yes → builds,
                 # deploys, and registers the contract, then ships the frontend
```

`pg deploy` writes the deployed address + ABI into `cdm.json`. The deploy itself
runs outside this session — see the deploy hand-off in CLAUDE.md.

(For a quick local compile/ABI check before deploying, `cargo pvm-contract build
-p leaderboard` works, but it is optional — `pg deploy` builds for you.)

## Cargo manifests

**Workspace `Cargo.toml`** — one SDK dependency:

```toml
[workspace.dependencies]
pvm-contract-sdk = { git = "https://github.com/paritytech/cargo-pvm-contract", branch = "main", features = ["alloc"] }
polkavm-derive = "0.31"
picoalloc = "5.2"
```

No `cdm`, `pvm_contract`, or `parity-scale-codec` unless the contract starts
importing other CDM packages (`cdm::import!`) or adds SCALE structs.

**`contracts/leaderboard/Cargo.toml`** — the package name lives in Cargo
metadata, NOT in the Rust macro:

```toml
[features]
abi-gen = ["pvm-contract-sdk/abi-gen"]

[package.metadata.cdm]
package = "@rps/leaderboard"

[dependencies]
pvm-contract-sdk = { workspace = true }
polkavm-derive = { workspace = true }
picoalloc = { workspace = true }
```

Package names are globally owned in the registry — use an app-specific
namespace (`@rps/leaderboard`), not `@example/...`.

## Contract shape — receiver-based SDK (`contracts/leaderboard/lib.rs`)

The macro is `#[pvm_contract_sdk::contract(...)]` on a module with a storage
`struct` (slots via `#[slot(N)]`), an `impl` with `#[constructor]` / `#[method]`
receivers (`&self` / `&mut self`), and typed errors via `sol_revert_enum!`.
Return `Address` (encodes as Solidity `address`), not `[u8; 20]`/`bytes20`.

```rust
#![cfg_attr(not(feature = "abi-gen"), no_main, no_std)]

#[pvm_contract_sdk::contract(allocator = "pico", allocator_size = 4096)]
mod leaderboard {
    use alloc::string::String;
    use pvm_contract_sdk::{Address, HostApi, Lazy, Mapping};

    pvm_contract_sdk::sol_revert_enum! {
        pub enum Error {
            AlreadyRegistered(AlreadyRegistered),
            NotRegistered(NotRegistered),
            IndexOutOfBounds(IndexOutOfBounds),
        }
    }
    #[derive(Debug, pvm_contract_sdk::SolError)] pub struct AlreadyRegistered;
    #[derive(Debug, pvm_contract_sdk::SolError)] pub struct NotRegistered;
    #[derive(Debug, pvm_contract_sdk::SolError)] pub struct IndexOutOfBounds;

    pub struct Leaderboard {
        #[slot(0)] player_count: Lazy<u64>,
        #[slot(1)] player_at: Mapping<u64, [u8; 20]>,
        #[slot(2)] is_registered: Mapping<[u8; 20], bool>,
        #[slot(3)] player_cid: Mapping<[u8; 20], String>,
        #[slot(4)] player_points: Mapping<[u8; 20], i64>,
    }

    impl Leaderboard {
        #[pvm_contract_sdk::constructor]
        pub fn new(&mut self) { self.player_count.set(&0); }

        #[pvm_contract_sdk::method]
        pub fn register(&mut self) -> Result<u64, Error> {
            let caller = self.caller();
            if self.is_registered.get(&caller.0) { return Err(AlreadyRegistered.into()); }
            let idx = self.player_count.get();
            self.player_at.insert(&idx, &caller.0);
            self.is_registered.insert(&caller.0, &true);
            self.player_points.insert(&caller.0, &0);
            self.player_count.set(&(idx + 1));
            Ok(idx)
        }

        #[pvm_contract_sdk::method]
        pub fn update_result(&mut self, new_cid: String, points_delta: i64) -> Result<(), Error> {
            let caller = self.caller();
            if !self.is_registered.get(&caller.0) { return Err(NotRegistered.into()); }
            self.player_cid.insert(&caller.0, &new_cid);
            let current = self.player_points.get(&caller.0);
            self.player_points.insert(&caller.0, &(current + points_delta));
            Ok(())
        }

        #[pvm_contract_sdk::method]
        pub fn get_player_at(&self, index: u64) -> Result<Address, Error> {
            if index >= self.player_count.get() { return Err(IndexOutOfBounds.into()); }
            Ok(Address(self.player_at.get(&index)))
        }

        // get_player_count() -> u64; get_player_cid(Address) -> String;
        // get_player_points(Address) -> i64; is_registered(Address) -> bool
        // ... same receiver pattern ...

        fn caller(&self) -> Address {
            let mut buf = [0u8; 20];
            self.host().caller(&mut buf);
            Address(buf)
        }
    }
}
```

The build (run by `pg deploy`, or by an optional local `cargo pvm-contract
build -p leaderboard`) produces `leaderboard.polkavm` and `leaderboard.abi.json`
— the ABI should show `getPlayerAt() -> address`, `getPlayerCid(address)`, etc.,
and `register` as `nonpayable`.

## What `pg deploy` produces

`pg deploy` writes the deployed address + ABI into `cdm.json` for the frontend
to read. The shape is **flat** — top-level `registry`, `dependencies:
{ "@rps/leaderboard": "latest" }`, and `contracts["@rps/leaderboard"]` with
`version`, `address`, `abi`, `metadataCid`. There is no `targets` block and no
target-hash key — those were the old shape.

## Frontend integration

Add the contract layer to `src/utils.ts`, lazy-initing it on first method call
(holding a chain follow open at startup starves Bulletin submits). The account
comes from the Level 1 `SignerManager` state
(`const account = signerManager.getState().selectedAccount`) — `account.address`
is the SS58 origin, `account.getSigner()` the signer, `account.h160Address` the
contract key.

> **Source of truth for the live API is the auto-downloaded
> `product-sdk-contracts` skill** (fetched by `./setup.sh`, kept fresher than
> this file). If the snippet below and that skill diverge, follow the skill.
> In particular, on the current network Revive auto-maps accounts, so an
> explicit `ensureContractAccountMapped` step may no longer be needed — check
> the skill before adding one.

The pattern (illustrative — confirm against the skill):

```ts
import { createChainClient } from "@parity/product-sdk-chain-client";
import {
  ContractManager, createContractRuntimeFromClient, ensureContractAccountMapped,
} from "@parity/product-sdk-contracts";
import { paseo_asset_hub } from "@parity/product-sdk-descriptors/paseo-asset-hub";
import cdmJson from "../cdm.json";

// Create the chain client lazily, once, and reuse it. `client` below is the
// raw PolkadotClient for Asset Hub.
const chainClient = await createChainClient({ chains: { assetHub: paseo_asset_hub } });
const client = chainClient.raw.assetHub;

await client.getChainSpecData();
await client.getBestBlocks();           // wake the chain follow first

// 1. map the connected product account (plain runtime, no registry query)
const initRuntime = createContractRuntimeFromClient(client, paseo_asset_hub);
await ensureContractAccountMapped(initRuntime, account.address, account.getSigner());

// 2. NOW resolve live addresses from the registry
const manager = await ContractManager.fromLiveClient(
  cdmJson, client, paseo_asset_hub,
  {
    defaultOrigin:  account.address,
    defaultSigner:  account.getSigner(),
    registryOrigin: account.address,        // also a query origin → must be mapped
    libraries: ["@rps/leaderboard"],
  },
);
const lb = manager.getContract("@rps/leaderboard");

// queries return { success, value, gasRequired }; pass 0x… hex for address args
const res = await lb.getPlayerCid.query(account.h160Address);
await lb.register.tx();                                   // returns Result<u64, Error>
await lb.updateResult.tx(newCid, BigInt(pointsDelta));    // returns Result<(), Error>
```

Pass the `0x…` H160 string (`account.h160Address`) for `address` args — the
encoder accepts it directly. Don't build `Binary`/`FixedSizeBinary` —
cross-realm class identity breaks when substrate-bindings hoists multiple
copies. (`ContractManager` also accepts a `signerManager` option instead of
`defaultOrigin`/`defaultSigner` if you prefer to hand it the manager.)

## Common gotchas

- **`ContractLiveAddressResolutionError: Failed to resolve live address`** = the
  registry view query failed. On older networks this meant the query origin
  wasn't Revive-mapped; the current network auto-maps accounts, so first check
  the `product-sdk-contracts` skill for the current init/mapping requirements
  rather than reintroducing a manual map step.
- **`PJS does not support this signed-extension: AsPgas`** = the tx was signed
  outside the host product-account flow. Use `account.getSigner()` from the
  Level 1 `SignerManager` (its `HostProvider` pins the `createTransaction`
  path internally) — never wire a signer by hand.
- **`DuplicateContract`** on re-deploy is harmless (deterministic address).
- **Payment / `Invalid::Payment`-style failures** = an allowance/authorization
  problem, not a funding one. The active network has no faucet; do not send the
  developer to "grab test tokens." Surface it as an allowance issue.
- **H160 vs SS58**: the contract keys by H160 (`account.h160Address`, provided
  by `SignerAccount`); SS58 (`account.address`) is only for origin/signing.
  Don't roll your own keccak.
- **Points are `i64`** (losses subtract). **`register()` once per player** before
  any `update_result()` — check `isRegistered()` and auto-register on first save.

## Acceptance check

- `pg deploy` builds, deploys, and registers the contract; `cdm.json` has the
  flat shape with the registry and `@rps/leaderboard` address.
- A fresh player can `register()` then `update_result()` per match (mapping, if
  the network still needs it, happens automatically on first tx).
- Page refresh resolves the current address live from the registry.
- Leaderboard lists registered players sorted by points.

## Do NOT

- Don't use the old `#[pvm::storage]` / `#[pvm::contract(cdm = "...")]` macro —
  that's the legacy SDK. Use `#[pvm_contract_sdk::contract]` with receivers.
- Don't return `bytes20`; return `Address`.
- Don't use `ContractManager.fromClient` (snapshot) unless you intentionally want
  the installed address — the app wants live resolution.
- Don't import `@polkadot-api/sdk-ink` — dropped from product-sdk-contracts.
- Don't set up a standalone `cdm` account, import a mnemonic, or run a manual
  `cdm deploy` — `pg deploy` builds, deploys, and registers using the
  developer's product account. A stale standalone `cdm` may already be on disk
  from an older setup — ignore it; it's not part of this flow.
- Don't construct contract addresses by hand; deploy writes them into `cdm.json`.
