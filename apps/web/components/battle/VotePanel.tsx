"use client";
/** Vote for a side, see the split and the time left; after voting ends, the winner. Plus share. */
import { useEffect, useState } from "react";
import type { BattleView, Side } from "@orbis/shared";
import { authActions, useAuth } from "@/lib/auth";
import { timeLeft, voteBattle } from "@/lib/battle";
import { appBaseUrl } from "@/lib/env";
import { copyText } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import s from "./Battle.module.css";

export function battleUrl(slug: string) {
  return `${appBaseUrl()}/b/${slug}`;
}

export function VotePanel({ battle, onChange, prizeCr }: { battle: BattleView; onChange: (b: BattleView) => void; prizeCr?: number }) {
  const auth = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const total = battle.votes.a + battle.votes.b;
  const pct = (side: Side) => (total ? Math.round((battle.votes[side] / total) * 100) : 50);
  const closed = battle.status === "closed" || (battle.endsAt !== null && new Date(battle.endsAt).getTime() <= now);
  const url = battleUrl(battle.slug);

  const vote = async (side: Side) => {
    if (auth.status !== "authenticated") return authActions.openSignIn();
    setBusy(true);
    const r = await voteBattle(battle.slug, side);
    setBusy(false);
    if (typeof r === "string") toast(r);
    else {
      onChange(r);
      toast(`You voted for ${r[side].name}`);
    }
  };

  const name = (side: Side) => battle[side].name;
  return (
    <div className={`glass ${s.vote}`}>
      <div className={s.voteHead}>
        {closed ? (
          <b>{battle.winner === "a" || battle.winner === "b" ? `${name(battle.winner)} wins` : battle.winner === "tie" ? "It's a tie" : "Voting closed"}</b>
        ) : battle.myVote ? (
          <b>You voted for {name(battle.myVote)}</b>
        ) : (
          <b>Who won? Vote.</b>
        )}
        <span>
          {total} {total === 1 ? "vote" : "votes"}
          {!closed && battle.endsAt ? ` · ${timeLeft(battle.endsAt, now)}` : ""}
        </span>
      </div>
      <div className={s.sides}>
        {(["a", "b"] as const).map((side) => (
          <button
            key={side}
            className={`${s.side} ${battle.myVote === side ? s.mine : ""} ${battle.winner === side ? s.won : ""}`}
            disabled={busy || closed || battle.myVote !== null}
            onClick={() => vote(side)}
          >
            <span className={s.sideName}>{name(side)}</span>
            <span className={s.bar}>
              <i style={{ width: `${pct(side)}%` }} />
            </span>
            <small>{total ? `${pct(side)}%` : closed ? "" : auth.status === "authenticated" ? "Vote" : "Connect wallet to vote"}</small>
          </button>
        ))}
      </div>
      {!closed && prizeCr ? <p className={s.note}>When voting ends, the winning agent gets level points and its creator gets {prizeCr} CR.</p> : null}
      <div className={s.share}>
        <button
          className="btn btn-glass btn-xs"
          onClick={async () => {
            await copyText(url);
            toast("Link copied");
          }}
        >
          Copy link
        </button>
        <a className="btn btn-glass btn-xs" href={`https://x.com/intent/post?text=${encodeURIComponent(`${name("a")} vs ${name("b")} on Mochibo. Who won? Vote:`)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
          Post to X
        </a>
      </div>
    </div>
  );
}
