---
quest: level-1
title: Local Challenger — AI context
---

# Context for Claude / AI pair

You are helping a developer complete **Level 1: Local Challenger**.

Read [00-overview.md](00-overview.md) first for the SDK package set and the
critical invariants. This file is the account/signing + local-game specifics.

## Starting state (what's already in the repo)

- `SignerManager` from `@parity/product-sdk-signer` set up in `src/utils.ts`
  with a `HostProvider` (product account `playground-tutorial.dot`, derivation 0)
  and a `DevProvider` fallback
- `App.tsx` connects on mount via
  `signerManager.connect(isInsideContainerSync() ? "host" : "dev")` and
  auto-selects the first account
- Best-of-3 vs computer (`src/pages/SoloGame.tsx`)
- Results saved in `localStorage` under key `rps-game:<ss58Address>`
- Profile card showing W/L/D, win rate, recent games (`src/pages/MyProfile.tsx`)
- No smart contracts, no Bulletin, no Statement Store

## Goal

Ship a **modded** version to the developer's own `.dot` domain on Paseo Next v2.
Modding can be visual (theming, emoji sets) or behavioral (computer personality,
trash-talk, sound). Contract/chain changes are out of scope for this level.

## Runtime requirements

- **A Polkadot host** — `dot.li` in a browser, or the Polkadot Desktop app
  (≥ 0.7.5). The host ships the host-api 0.8.x wire protocol the current SDK
  targets.
- **Polkadot mobile (v2)** if signing on a paired phone.
- Plain browser works for UI iteration via the `DevProvider` fallback (dev
  accounts: Alice, Bob, …) — but host signing and deploy verification need
  a Polkadot host (`dot.li` or the Polkadot Desktop app).

## Packages in play

Use the **latest** published versions (do not pin):

- `@parity/product-sdk-signer` — `SignerManager`, `HostProvider`, `DevProvider`
- `@parity/product-sdk-host` — `isInsideContainerSync()`

Do not import `@novasamatech/product-sdk` (frozen) or
`@novasamatech/host-api-wrapper` (low-level layer the signer wraps) directly.

## Account flow (the actual `src/utils.ts` / `App.tsx` pattern)

```ts
import {
    SignerManager, HostProvider, DevProvider, type SignerState,
} from "@parity/product-sdk-signer";
import { isInsideContainerSync } from "@parity/product-sdk-host";

const PRODUCT_ID = "playground-tutorial.dot";   // update to <your-name>.dot after deploy

export const signerManager = new SignerManager({
    dappName: "playground-tutorial",
    createProvider: (type) => type === "host"
        ? new HostProvider({
              productAccount: { dotNsIdentifier: PRODUCT_ID, derivationIndex: 0 },
          })
        : new DevProvider(),
});

// In App.tsx, on mount:
const result = await signerManager.connect(isInsideContainerSync() ? "host" : "dev");
if (result.ok && result.value.length > 0) {
    signerManager.selectAccount(result.value[0].address);
}

// Everywhere else, read state (React: useSyncExternalStore via useSignerState()):
const { status, accounts, selectedAccount, error } = signerManager.getState();
selectedAccount?.address;       // SS58 — localStorage key, tx origin
selectedAccount?.h160Address;   // 0x… H160 — contract keying (Level 3)
selectedAccount?.getSigner();   // PolkadotSigner — txs (Levels 2-4)
```

The `productAccount` option makes `HostProvider` use the host's
product-account flow (`getProductAccount`) and pin the `createTransaction`
signing path internally — no manual signer wiring, no `signerType` to pass.

## Common gotchas

- **Host login only works inside a Polkadot host (`dot.li` or the Polkadot Desktop app).** In a plain
  browser the app falls back to `DevProvider` dev accounts — fine for UI
  modding, useless for verifying host signing.
- **Keep `PRODUCT_ID` consistent.** It scopes the host product account and is
  reused by the Level 4 statement-store identity. When deploying to the
  developer's own domain, change it to `"<their-name>.dot"`.
- **localStorage keys are per-account** (`rps-game:<ss58Address>`). Switching
  accounts swaps the profile.
- **Don't prompt to add contracts/Bulletin** — that's Level 2 / Level 3.

## Ship checklist

1. `npm run build` produces `dist/`
2. Deploy: `pg deploy` from the terminal (the playground CLI — `pg` is the short
   alias for `playground`); in RevX, use its built-in `.dot` deploy if the
   environment has it enabled — otherwise hand off to the playground CLI (`pg`)
3. Open `<name>.dot` inside a Polkadot host (`dot.li` in a browser, or Polkadot Desktop ≥ 0.7.5) to verify

## Do NOT

- Don't reintroduce `@novasamatech/product-sdk` or import
  `@novasamatech/host-api-wrapper` directly — the `@parity/product-sdk-*`
  packages are the supported surface.
- Don't build signers by hand or pass a `signerType` — `HostProvider` handles it.
- Don't pin SDK versions — install `@latest`.
