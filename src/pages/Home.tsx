import MyProfile from "./MyProfile";
import type { Account } from "../types";

export default function Home({ account, onSolo, onLeaderboard, refreshKey }: {
    account: Account | null;
    onSolo: () => void;
    onLeaderboard: () => void;
    refreshKey?: number;
}) {
    return (
        <div>
            {account && <MyProfile account={account} refreshKey={refreshKey} />}

            <div className="home">
                <div className="home-title">Rock Paper Scissors</div>
                <div className="home-subtitle">Play against the computer</div>

                <div className="home-modes">
                    <div className="mode-card" onClick={onSolo}>
                        <div className="mode-card-title">Solo</div>
                        <div className="mode-card-desc">Best of 3 vs computer — results saved on-chain via Bulletin</div>
                    </div>
                    <div className="mode-card" onClick={onLeaderboard}>
                        <div className="mode-card-title">Leaderboard</div>
                        <div className="mode-card-desc">View the on-chain leaderboard for registered players</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
