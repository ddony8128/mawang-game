import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Home, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useGameResultStore } from "@/stores/resultStore";
import { useClientStore } from "@/stores/clientStore";
import type { GameEndState } from "@/types/ws";
import imgVictory from "@/assets/result/승리.jpg";
import imgDefeat from "@/assets/result/패배.jpg";

const ROLE_DISPLAY_NAME: Record<string, string> = {
  mawang_fear: "공포의 마왕",
  mawang_troll: "분탕의 마왕",
  aide: "참모",
  fallen: "타락자",
  parryman: "패링맨",
  slayer: "슬레이어",
  sage: "현자",
  healer: "힐러",
  weakling: "약골",
  coward: "겁쟁이",
  madman: "정신병자",
  experiment_host: "실험체",
};

function buildWinningTeam(endState: GameEndState): "good" | "evil" {
  if (endState.reason === "MAWANG_DEAD") return "good";
  if (endState.reason === "ALL_HERO_DEAD") return "evil";
  // ABORTED 등 기타 케이스는 결과에서 실제 승리 팀을 유추
  const hasGoodWin = endState.results.some((r) => r.team === "good" && r.win);
  if (hasGoodWin) return "good";
  return "evil";
}

export function ResultPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const endState = useGameResultStore(
    (s) => (roomId ? s.endStates[roomId] : undefined),
  );
  const { sessions } = useClientStore();
  const session = roomId ? sessions[roomId] : undefined;

  const {
    myResult,
    isVictory,
    winningTeam,
    reasonText,
    players,
  }: {
    myResult: GameEndState["results"][number] | null;
    isVictory: boolean;
    winningTeam: "good" | "evil" | null;
    reasonText: string;
    players: Array<{
      id: string;
      nickname: string;
      roleKey: string;
      roleName: string;
      teamLabel: string;
      isWinner: boolean;
      isDead: boolean;
    }>;
  } = useMemo(() => {
    if (!endState) {
      return {
        myResult: null,
        isVictory: false,
        winningTeam: null,
        reasonText: "",
        players: [],
      };
    }

    const winTeam = buildWinningTeam(endState);

    const me =
      session?.roomPlayerId
        ? endState.results.find((r) => r.playerId === session.roomPlayerId) ??
          null
        : null;

    const isMeVictory = !!me?.win;

    const reason =
      endState.reason === "MAWANG_DEAD"
        ? "마왕이 사망했습니다!"
        : endState.reason === "ALL_HERO_DEAD"
          ? "모든 용사가 사망했습니다!"
          : "게임이 중단되었습니다.";

    const playerRows = endState.results.map((r) => ({
      id: r.playerId,
      nickname: r.nickname,
      roleKey: r.role,
      roleName: ROLE_DISPLAY_NAME[r.role] ?? r.role,
      teamLabel: r.team === "good" ? "선 팀" : "악 팀",
      isWinner: r.win,
      isDead: !r.alive,
    }));

    return {
      myResult: me,
      isVictory: isMeVictory,
      winningTeam: winTeam,
      reasonText: reason,
      players: playerRows,
    };
  }, [endState, session?.roomPlayerId]);

  const imageUrl = isVictory ? imgVictory : imgDefeat;

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-6">
      <div className="glass-card max-w-2xl w-full rounded-2xl p-8 space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
            <Trophy className="w-9 h-9 text-accent" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-gradient-gold">
              이번 판이 종료되었습니다
            </h1>
            {roomId && (
              <p className="text-xs text-muted-foreground/70">
                roomId: <span className="font-mono">{roomId}</span>
              </p>
            )}
          </div>
        </div>

        {endState ? (
          <>
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <img
                src={imageUrl}
                alt={isVictory ? "승리" : "패배"}
                className="w-32 h-32 object-contain rounded-xl shadow-lg"
              />
              <div className="flex-1 space-y-2 text-center md:text-left">
                <p className="text-lg font-bold">
                  {winningTeam === "good" ? "선 팀" : "악 팀"}의 승리
                </p>
                <p className="text-sm text-muted-foreground">{reasonText}</p>
                {myResult && (
                  <p className="text-sm mt-2">
                    당신은{" "}
                    <span className="font-semibold">
                      {ROLE_DISPLAY_NAME[myResult.role] ?? myResult.role}
                    </span>
                    (
                    {myResult.team === "good" ? "선 팀" : "악 팀"}
                    )으로{" "}
                    <span className="font-semibold">
                      {myResult.win ? "승리" : "패배"}
                    </span>
                    했습니다.
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-border/60 pt-4">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                최종 역할 및 승패
              </h2>
              <div className="max-h-64 overflow-auto rounded-lg border border-border/40">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-left">플레이어</th>
                      <th className="px-3 py-2 text-left">역할</th>
                      <th className="px-3 py-2 text-left">팀</th>
                      <th className="px-3 py-2 text-left">상태</th>
                      <th className="px-3 py-2 text-left">결과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p) => (
                      <tr
                        key={p.id}
                        className={
                          p.isWinner
                            ? "bg-emerald-950/40"
                            : p.isDead
                              ? "bg-destructive/5"
                              : "bg-card"
                        }
                      >
                        <td className="px-3 py-2">
                          <span className="font-medium">{p.nickname}</span>
                        </td>
                        <td className="px-3 py-2">{p.roleName}</td>
                        <td className="px-3 py-2">{p.teamLabel}</td>
                        <td className="px-3 py-2">
                          {p.isDead ? "사망" : "생존"}
                        </td>
                        <td className="px-3 py-2">
                          {p.isWinner ? "승리" : "패배"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              이 방의 게임 종료 결과 정보를 찾을 수 없습니다.
            </p>
            <p className="text-xs text-muted-foreground/80">
              게임이 정상적으로 종료된 직후에만 결과가 표시됩니다.
            </p>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <Button
            variant="gold"
            className="w-full"
            onClick={() => navigate("/rooms")}
          >
            대기 중인 다른 방 보기
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/")}
          >
            <Home className="w-4 h-4 mr-2" />
            메인으로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  );
}

