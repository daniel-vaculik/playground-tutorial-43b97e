---
quest: level-2
title: On-Chain Record — AI context
---

# Context for Claude / AI pair

You are helping a developer complete **Level 2: On-Chain Record**.

Read [00-overview.md](00-overview.md) first for the SDK package set and invariants.

## Goal

Move the game history JSON itself to Bulletin Chain (content-addressed). Keep a **CID pointer in localStorage** per account (`rps-game-cid:<ss58Address>`) so the app can resolve the latest history back to the player on reload. In Level 3, this pointer moves out of localStorage and into the leaderboard smart contract.

None of this exists in the repo yet — the developer builds it in this level (add the helpers to `src/utils.ts`).

## Network

Paseo Next v2 (v1 retired 2026-05-20):

- **Bulletin Next**: `wss://paseo-bulletin-next-rpc.polkadot.io`
- **IPFS gateway** (manual verification): `https://paseo-bulletin-next-ipfs.polkadot.io/ipfs/<cid>`
- Cloud Storage preset: `environment: "paseo"` (a `"summit"` preset exists for the event network)

## What to use (current SDK)

`@parity/product-sdk-cloud-storage` (latest — do not pin). `CloudStorageClient`
wraps the Bulletin chain: `store()` submits a signed `TransactionStorage.store`
extrinsic and handles chunking, manifests, and CID calculation; `fetchBytes()`
reads back through the **host's preimage subscription** (container-only — there
is no public-gateway fetch in the client).

```ts
// In src/utils.ts — signerManager is already defined in this file (Level 1).
import { CloudStorageClient, createLazySigner } from "@parity/product-sdk-cloud-storage";

// Create once, lazily — the signer resolves at submit time, after connect.
const client = await CloudStorageClient.create({
    environment: "paseo",
    signer: createLazySigner(() => signerManager.getSigner()),
});

// Upload: bytes in → signed extrinsic → CID out.
async function uploadToBulletin(bytes: Uint8Array): Promise<string> {
    const result = await client.store(bytes).send();
    if (!result.cid) throw new Error("upload returned no CID");
    return result.cid.toString();
}

// Read back (inside the host):
async function fetchFromBulletin(cid: string): Promise<Uint8Array> {
    return client.fetchBytes(cid);
}
```

`checkAuthorization` from the same package does a pre-flight check that the
connected account is allowed to store on Bulletin. If the account has no
Bulletin allowance, the fallback is the **host-sponsored** path for small blobs:
`getPreimageManager()` from `@parity/product-sdk-host`, then
`preimageManager.submit(bytes)` — the host's account pays for storage.

## CID pointer flow (the Level 2 addition)

```ts
const CID_KEY = (addr: string) => `rps-game-cid:${addr}`;

// On match end:
const playerData = { games: [...existing, newGame], wins, losses, draws };
const bytes = new TextEncoder().encode(JSON.stringify(playerData));
const cid = await uploadToBulletin(bytes);
localStorage.setItem(CID_KEY(account.address), cid);

// On profile load:
const cid = localStorage.getItem(CID_KEY(account.address));
if (cid) {
    const bytes = await fetchFromBulletin(cid);
    const data = JSON.parse(new TextDecoder().decode(bytes));
    // render profile from `data`
}
```

## Common gotchas

- **`store()` needs a connected account.** The lazy signer resolves
  `signerManager.getSigner()` at submit time — make sure connect has succeeded
  (Level 1 flow) before the first upload. Dev-provider accounts outside the
  host won't have Bulletin allowance.
- **Reads are container-only.** `fetchBytes` routes through the host's
  preimage subscription — it works inside a Polkadot host (`dot.li` or the
  Polkadot Desktop app), not in a plain browser. For manual verification, paste the CID into the public IPFS
  gateway URL instead.
- **The SDK owns chunking and CIDs.** Don't hand-roll blake2b/multihash CID
  computation — `store()` returns the CID, and `calculateCid` is exported if
  you need it standalone.
- **CIDs are deterministic.** Re-uploading identical bytes returns the same CID
  — useful for idempotency, but don't rely on it as a "did this upload
  succeed?" check; verify via the gateway instead.
- **First store may prompt.** Inside the host, transaction submission shows a
  host approval prompt — design the UX around it (e.g. a "saving…" state).

## Acceptance check

- Log the CID, paste it into `https://paseo-bulletin-next-ipfs.polkadot.io/ipfs/<cid>`, confirm JSON is readable
- Refresh the page → profile reloads from Bulletin via the localStorage CID pointer

## Do NOT

- Don't add a smart contract yet — Level 3
- Don't add multiplayer — Level 4
- Don't import `@novasamatech/host-api-wrapper` directly — `getPreimageManager()`
  from `@parity/product-sdk-host` is the supported surface for the host-sponsored path
- Don't open your own WS connection to Bulletin or hardcode old Paseo v1
  endpoints (`asset-hub-paseo-rpc.n.dwellir.com`, `paseo-ipfs.polkadot.io`, …)
  — the SDK presets own the connection
