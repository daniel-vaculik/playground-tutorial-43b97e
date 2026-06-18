import { useState, useEffect, useSyncExternalStore } from "react";
import {
    SignerManager,
    HostProvider,
    DevProvider,
    type SignerState,
} from "@parity/product-sdk-signer";
import { isInsideContainerSync } from "@parity/product-sdk-host";
import { CloudStorageClient, createLazySigner } from "@parity/product-sdk-cloud-storage";
import { createChainClient } from "@parity/product-sdk-chain-client";
import { ContractManager } from "@parity/product-sdk-contracts";
import { paseo_asset_hub } from "@parity/product-sdk-descriptors/paseo-asset-hub";
import cdmJson from "../cdm.json";
import type { Account, LeaderboardEntry, Move, RoundResult, PlayerData, GameData } from "./types.ts";

// ---------------------------------------------------------------------------
// Signer Manager (Host API)
// ---------------------------------------------------------------------------

const PRODUCT_ID = "playground-tutorial.dot";
let useProductAccount = true;

export function disableHostProductAccount() {
    useProductAccount = false;
}

export const signerManager = new SignerManager({
    dappName: "playground-tutorial",
    createProvider: (type) => type === "host"
            ? new HostProvider(
                  useProductAccount
                      ? { productAccount: { dotNsIdentifier: PRODUCT_ID, derivationIndex: 0 } }
                      : undefined,
              )
            : new DevProvider()
    
});

export function useSignerState(): SignerState {
   return useSyncExternalStore(
    (cb) => signerManager.subscribe(cb),
    () => signerManager.getState(),
  );
}

// ---------------------------------------------------------------------------
// Game helpers
// ---------------------------------------------------------------------------

export const short = (addr: string) => addr.slice(0, 6) + "..." + addr.slice(-4);

export function determineWinner(player: Move, opponent: Move): RoundResult {
    if (player === opponent) return "draw";
    if (
        (player === "rock" && opponent === "scissors") ||
        (player === "paper" && opponent === "rock") ||
        (player === "scissors" && opponent === "paper")
    ) {
        return "win";
    }
    return "loss";
}

export function pointsForResult(result: RoundResult): number {
    if (result === "win") return 2;
    if (result === "loss") return -1;
    return 0;
}

const MOVES: Move[] = ["rock", "paper", "scissors"];

export function randomMove(): Move {
    return MOVES[Math.floor(Math.random() * 3)];
}

// ---------------------------------------------------------------------------
// LocalStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = "rps-game:";
const CID_KEY = (address: string) => `rps-game-cid:${address}`;

const CONTRACT_PACKAGE = "@best/gameever";
const CONTRACT_LIBRARIES = [CONTRACT_PACKAGE];

let cloudStorageClient: CloudStorageClient | null = null;
let chainClient: any | null = null;
let contractManager: any | null = null;

function contractMethod(contract: any, camel: string, snake: string) {
    return contract?.[camel] ?? contract?.[snake];
}

async function getContractManager(account: Account): Promise<any | null> {
    if (!account?.h160Address || !account.getSigner) return null;
    if (contractManager) return contractManager;

    try {
        if (!chainClient) {
            chainClient = await createChainClient({
                chains: { assetHub: paseo_asset_hub },
            });
        }

        const client = chainClient.raw.assetHub;
        await client.getChainSpecData();
        await client.getBestBlocks();

        contractManager = await ContractManager.fromLiveClient(
            cdmJson,
            client,
            paseo_asset_hub,
            {
                defaultOrigin: account.address,
                defaultSigner: account.getSigner(),
                registryOrigin: account.address,
                libraries: CONTRACT_LIBRARIES,
            },
        );

        return contractManager;
    } catch (error) {
        console.warn("Leaderboard contract init failed", error);
        return null;
    }
}

async function getLeaderboardContract(account: Account): Promise<any | null> {
    const manager = await getContractManager(account);
    if (!manager) return null;

    try {
        return manager.getContract(CONTRACT_PACKAGE);
    } catch (error) {
        console.warn("Failed to load leaderboard contract", error);
        return null;
    }
}

export async function isPlayerRegistered(account: Account): Promise<boolean> {
    const contract = await getLeaderboardContract(account);
    if (!contract || !account.h160Address) return false;

    const query = contractMethod(contract, "isRegistered", "is_registered");
    if (!query?.query) return false;

    try {
        const result = await query.query(account.h160Address);
        return Boolean(result?.success && result.value);
    } catch (error) {
        console.warn("Leaderboard registration query failed", error);
        return false;
    }
}

export async function registerPlayer(account: Account): Promise<boolean> {
    const contract = await getLeaderboardContract(account);
    if (!contract) return false;

    const tx = contractMethod(contract, "register", "register");
    if (!tx?.tx) return false;

    try {
        await tx.tx();
        return true;
    } catch (error) {
        console.warn("Leaderboard register failed", error);
        return false;
    }
}

export async function updateLeaderboardEntry(
    account: Account,
    newCid: string,
    pointsChange: number,
): Promise<boolean> {
    const contract = await getLeaderboardContract(account);
    if (!contract || !account.h160Address) return false;

    const update = contractMethod(contract, "updateResult", "update_result");
    if (!update?.tx) return false;

    try {
        const registered = await isPlayerRegistered(account);
        if (!registered) {
            const didRegister = await registerPlayer(account);
            if (!didRegister) return false;
        }

        await update.tx(newCid, BigInt(pointsChange));
        return true;
    } catch (error) {
        console.warn("Leaderboard update failed", error);
        return false;
    }
}

export async function getLeaderboardEntries(account: Account): Promise<LeaderboardEntry[]> {
    const contract = await getLeaderboardContract(account);
    if (!contract) return [];

    const countQuery = contractMethod(contract, "getPlayerCount", "get_player_count");
    const addressQuery = contractMethod(contract, "getPlayerAt", "get_player_at");
    const cidQuery = contractMethod(contract, "getPlayerCid", "get_player_cid");
    const pointsQuery = contractMethod(contract, "getPlayerPoints", "get_player_points");

    if (!countQuery?.query || !addressQuery?.query || !cidQuery?.query || !pointsQuery?.query) {
        return [];
    }

    try {
        const countRes = await countQuery.query();
        if (!countRes?.success) return [];

        const count = Number(countRes.value ?? 0);
        const entries: LeaderboardEntry[] = [];

        for (let index = 0; index < count; index++) {
            const addressRes = await addressQuery.query(BigInt(index));
            if (!addressRes?.success || !addressRes.value) continue;

            const address = addressRes.value as string;
            const cidRes = await cidQuery.query(address);
            const pointsRes = await pointsQuery.query(address);

            entries.push({
                address,
                cid: cidRes?.success ? String(cidRes.value) : "",
                points: pointsRes?.success ? Number(pointsRes.value) : 0,
            });
        }

        return entries.sort((a, b) => b.points - a.points);
    } catch (error) {
        console.warn("Leaderboard fetch failed", error);
        return [];
    }
}

export async function saveGameResult(account: Account, game: Omit<GameData, "id">): Promise<PlayerData> {
    const data = await appendGame(account.address, game);
    const cid = getBulletinCid(account.address);
    if (cid && isInsideContainerSync() && account.h160Address) {
        updateLeaderboardEntry(account, cid, game.pointsChange).catch(err => {
            console.warn("Could not update leaderboard", err);
        });
    }
    return data;
}

async function getCloudStorageClient(): Promise<CloudStorageClient> {
    if (!cloudStorageClient) {
        cloudStorageClient = await CloudStorageClient.create({
            environment: "paseo",
            signer: createLazySigner(() => signerManager.getSigner()),
        });
    }
    return cloudStorageClient;
}

function loadPlayerDataFromLocal(address: string): PlayerData {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + address);
        if (raw) return JSON.parse(raw);
    } catch { /* fall through */ }
    return {
        player: address,
        totalGames: 0, wins: 0, losses: 0, draws: 0, points: 0,
        games: [],
    };
}

export async function loadPlayerData(address: string): Promise<PlayerData> {
    if (isInsideContainerSync()) {
        const cid = localStorage.getItem(CID_KEY(address));
        if (cid) {
            try {
                const client = await getCloudStorageClient();
                const bytes = await client.fetchBytes(cid);
                return JSON.parse(new TextDecoder().decode(bytes));
            } catch (error) {
                console.warn("Bulletin load failed, falling back to localStorage", error);
            }
        }
    }
    return loadPlayerDataFromLocal(address);
}

export function savePlayerData(data: PlayerData) {
    localStorage.setItem(STORAGE_PREFIX + data.player, JSON.stringify(data));
}

export async function appendGame(address: string, game: Omit<GameData, "id">): Promise<PlayerData> {
    const data = await loadPlayerData(address);
    const fullGame: GameData = { ...game, id: data.games.length + 1 };
    data.games.push(fullGame);
    data.totalGames++;
    if (game.result === "win") data.wins++;
    else if (game.result === "loss") data.losses++;
    else data.draws++;
    data.points += game.pointsChange;
    savePlayerData(data);

    if (isInsideContainerSync()) {
        try {
            const client = await getCloudStorageClient();
            const bytes = new TextEncoder().encode(JSON.stringify(data));
            const result = await client.store(bytes).send();
            if (result.cid) {
                localStorage.setItem(CID_KEY(address), result.cid.toString());
            } else {
                console.warn("Bulletin upload returned no CID");
            }
        } catch (error) {
            console.warn("Bulletin upload failed", error);
        }
    }

    return data;
}

export function getBulletinCid(address: string): string | null {
    return localStorage.getItem(CID_KEY(address));
}
