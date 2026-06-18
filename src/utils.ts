import { useState, useEffect, useSyncExternalStore } from "react";
import {
    SignerManager,
    HostProvider,
    DevProvider,
    type SignerState,
} from "@parity/product-sdk-signer";
import { isInsideContainerSync } from "@parity/product-sdk-host";
import { CloudStorageClient, createLazySigner } from "@parity/product-sdk-cloud-storage";
import type { Move, RoundResult, PlayerData, GameData } from "./types.ts";

// ---------------------------------------------------------------------------
// Signer Manager (Host API)
// ---------------------------------------------------------------------------

const PRODUCT_ID = "playground-tutorial.dot";

export const signerManager = new SignerManager({
    dappName: "playground-tutorial",
    createProvider: (type) => type === "host"
            ? new HostProvider({
                  productAccount: { dotNsIdentifier: PRODUCT_ID, derivationIndex: 0 },
              })
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

let cloudStorageClient: CloudStorageClient | null = null;

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
