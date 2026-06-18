import { useState, useEffect } from "react";
import { getLeaderboardEntries, short } from "../utils";
import type { Account, LeaderboardEntry } from "../types";

export default function Leaderboard({ account }: { account: Account }) {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getLeaderboardEntries(account).then(data => {
            if (!cancelled) setEntries(data);
        }).finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => { cancelled = true; };
    }, [account]);

    return (
        <div className="leaderboard-page">
            <h2>Leaderboard</h2>
            {loading ? (
                <div className="status">Loading leaderboard…</div>
            ) : entries.length === 0 ? (
                <div className="status">No registered players yet.</div>
            ) : (
                <div className="leaderboard-table">
                    <div className="leaderboard-row leaderboard-header">
                        <span>Rank</span>
                        <span>Player</span>
                        <span>Points</span>
                        <span>Bulletin CID</span>
                    </div>
                    {entries.map((entry, index) => (
                        <div key={entry.address} className="leaderboard-row">
                            <span>#{index + 1}</span>
                            <span>{short(entry.address)}</span>
                            <span>{entry.points}</span>
                            <span>{entry.cid ? entry.cid.slice(0, 8) + "…" : "-"}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
