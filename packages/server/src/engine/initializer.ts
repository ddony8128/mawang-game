import crypto from "crypto";

import { supabase } from "../db/supabase";
import { listRoomPlayers } from "../db/roomPlayersRepo";
import type { GameSnapshot, PlayerState } from "../types/serverState";
import type { GameSettings } from "../types/gameSettings";
import type { CardInstance, CardType } from "../types/cards";
import type { RoleKey, Side, Team } from "../types/identity";
import type { GameLogState, LogItem } from "../types/effects";

type GameRow = {
  id: string;
  room_id: string;
  seq: number;
  state: "running" | "ended" | "aborted";
  settings: GameSettings;
  rng_seed: string;
};

function makeDeterministicRng(seed: string | number) {
  let counter = 0;
  const next = () => {
    const hash = crypto.createHash("sha256");
    // Supabase 가 BIGINT 컬럼을 number 로 반환하는 경우가 있어
    // 항상 문자열로 변환한 뒤 해시에 넣어준다.
    hash.update(String(seed));
    hash.update(String(counter));
    const digest = hash.digest();
    const a = digest.readUInt32BE(0);
    const b = digest.readUInt32BE(4);
    const combined = (a ^ b) >>> 0;
    counter += 1;
    return combined / 0xffffffff;
  };
  return { next, getCounter: () => counter };
}

function randomChoice<T>(arr: T[], rnd: () => number): T {
  const idx = Math.floor(rnd() * arr.length);
  return arr[Math.max(0, Math.min(arr.length - 1, idx))];
}

function randomShuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomCardType(rnd: () => number): CardType {
  const r = rnd();
  if (r < 0.25) return "magnifier";
  if (r < 0.5) return "knife";
  if (r < 0.75) return "bomb";
  return "beer";
}

function createCard(type: CardType, nowMs: number): CardInstance {
  return {
    id: crypto.randomUUID(),
    type,
    createdAtMs: nowMs,
  };
}

function roleComposition(count: number): {
  traitor: number;
  hero: number;
  civil: number;
} {
  switch (count) {
    case 6:
      return { traitor: 1, hero: 3, civil: 1 };
    case 7:
      return { traitor: 1, hero: 2, civil: 3 };
    case 8:
      return { traitor: 2, hero: 3, civil: 2 };
    case 9:
      return { traitor: 2, hero: 2, civil: 4 };
    case 10:
      return { traitor: 2, hero: 3, civil: 4 };
    default:
      // fallback: 최소 구성
      return { traitor: 1, hero: 2, civil: Math.max(0, count - 3) };
  }
}

function createEmptyLogState(): GameLogState {
  return {
    lastSeq: 0,
    items: [],
  };
}

function appendLog(
  log: GameLogState,
  item: Omit<LogItem, "id" | "seq">,
): LogItem {
  const id = crypto.randomUUID();
  const seq = log.lastSeq + 1;
  const full: LogItem = {
    id,
    seq,
    ...item,
  };
  log.lastSeq = seq;
  log.items.push(full);
  return full;
}

export async function createInitialSnapshotForRoom(
  roomId: string,
): Promise<GameSnapshot | null> {
  // 최신 running 게임 row를 가져온다.
  const { data: gameRow, error } = await supabase
    .from("games")
    .select<"*", GameRow>("*")
    .eq("room_id", roomId)
    .eq("state", "running")
    .order("seq", { ascending: false })
    .limit(1)
    .single();

  if (error || !gameRow) {
    // eslint-disable-next-line no-console
    console.error("[initializer] failed to load running game for room:", error);
    return null;
  }

  const rawSettings = (gameRow.settings as Partial<GameSettings>) ?? {};
  const settings: GameSettings = {
    drawIntervalSec: rawSettings.drawIntervalSec ?? 180,
    bombDelaySec: rawSettings.bombDelaySec ?? 300,
    handLimit: rawSettings.handLimit ?? 4,
    fearReviveHp: rawSettings.fearReviveHp ?? 3,
    trollSurviveSec: rawSettings.trollSurviveSec ?? 180,
    teamCounts: {
      traitor: rawSettings.teamCounts?.traitor ?? 1,
      hero: rawSettings.teamCounts?.hero ?? 3,
      civil: rawSettings.teamCounts?.civil ?? 1,
    },
    gmMode: {
      enabled: rawSettings.gmMode?.enabled ?? false,
      hostIsGM: rawSettings.gmMode?.hostIsGM ?? false,
      fixedRoles: rawSettings.gmMode?.fixedRoles ?? {},
    },
  };

  const rngSeed = gameRow.rng_seed;
  const nowMs = Date.now();

  const rng = makeDeterministicRng(rngSeed);

  const roomPlayers = await listRoomPlayers(roomId);
  const seating = roomPlayers.map((p) => p.id);

  const totalPlayers = roomPlayers.length;
  const totalNonMawang = Math.max(0, totalPlayers - 1);

  // teamCounts 설정이 유효하면 우선 사용하고, 아니면 GDD 기본값 사용
  const baseComp = roleComposition(totalPlayers);
  let traitorTarget = settings.teamCounts?.traitor ?? baseComp.traitor;
  let heroTarget = settings.teamCounts?.hero ?? baseComp.hero;
  let civilTarget = settings.teamCounts?.civil ?? baseComp.civil;
  if (traitorTarget + heroTarget + civilTarget !== totalNonMawang) {
    // 합이 맞지 않으면 GDD 기본 구성으로 되돌린다.
    traitorTarget = baseComp.traitor;
    heroTarget = baseComp.hero;
    civilTarget = baseComp.civil;
  }

  // 역할 풀 구성 (GDD 기준: 동일 역할 중복 없음)
  const heroRoles: RoleKey[] = ["parryman", "slayer", "sage", "healer"];
  const civilRoles: RoleKey[] = [
    "weakling",
    "coward",
    "madman",
    "experiment_host",
  ];

  const chosenHeroes = randomShuffle(heroRoles, rng.next).slice(0, heroTarget);
  const chosenCivils = randomShuffle(civilRoles, rng.next).slice(
    0,
    civilTarget,
  );

  const traitorRoles: RoleKey[] = ["aide", "fallen"];
  const chosenTraitors = randomShuffle(traitorRoles, rng.next).slice(
    0,
    traitorTarget,
  );

  // 플레이어별 역할 할당 순서:
  // - GM fixedRoles 를 우선 적용
  // - 1명: mawang (GM 이 지정했으면 그 플레이어, 아니면 랜덤)
  // - 나머지 인원에서 traitor/hero/civil 목표 수만큼 채움
  const roleByPlayer = new Map<string, RoleKey>();
  const gmMode = settings.gmMode;

  if (gmMode?.enabled && gmMode.fixedRoles) {
    for (const [playerId, role] of Object.entries(gmMode.fixedRoles)) {
      if (!seating.includes(playerId)) continue;
      roleByPlayer.set(playerId, role);
    }
  }

  // GM 이 지정한 마왕이 있으면 우선 사용, 없으면 랜덤으로 결정
  let mawangId: string | undefined;
  for (const [pid, role] of roleByPlayer.entries()) {
    if (role === "mawang_fear" || role === "mawang_troll") {
      if (!mawangId) {
        mawangId = pid;
      } else {
        // 두 번째 이후 마왕 지정은 무시하고 다시 배정 대상으로 돌린다.
        roleByPlayer.delete(pid);
      }
    }
  }

  const shuffledPlayers = randomShuffle(seating, rng.next);
  if (!mawangId) {
    if (shuffledPlayers.length === 0) return null;
    mawangId = shuffledPlayers[0];
    if (!roleByPlayer.has(mawangId)) {
      roleByPlayer.set(mawangId, "mawang_fear");
    }
  }

  // GM이 이미 traitor/hero/civil 역할을 일부 채웠다면 목표 수에서 빼준다.
  for (const [pid, role] of roleByPlayer.entries()) {
    if (pid === mawangId) continue;
    if (role === "aide" || role === "fallen") {
      traitorTarget = Math.max(0, traitorTarget - 1);
    } else if (heroRoles.includes(role)) {
      heroTarget = Math.max(0, heroTarget - 1);
    } else if (civilRoles.includes(role)) {
      civilTarget = Math.max(0, civilTarget - 1);
    }
  }

  const rest = shuffledPlayers.filter(
    (id) => id !== mawangId && !roleByPlayer.has(id),
  );

  let idx = 0;
  // 1) 배신자 역할 배정
  for (let i = 0; i < traitorTarget && idx < rest.length; i += 1) {
    const role = chosenTraitors[i] ?? randomChoice(traitorRoles, rng.next);
    roleByPlayer.set(rest[idx], role);
    idx += 1;
  }
  // 2) 용사 역할 배정
  for (let i = 0; i < heroTarget && idx < rest.length; i += 1) {
    const role = chosenHeroes[i] ?? randomChoice(heroRoles, rng.next);
    roleByPlayer.set(rest[idx], role);
    idx += 1;
  }
  // 3) 시민 역할 배정
  //    - civilTarget 은 GDD 기준으로 최대 4이고, civilRoles 도 4개이므로
  //      기본 구성에서는 중복 없이 배정 가능하다.
  //    - teamCounts 를 커스터마이즈하여 civilTarget > civilRoles.length 인 경우,
  //      초과 인원에 대해서만 중복이 발생할 수 있다.
  const remainingCivilPlayers = rest.slice(idx);
  const remainingCivilCount = remainingCivilPlayers.length;
  const civilRolePool = randomShuffle(civilRoles, rng.next);
  for (let i = 0; i < remainingCivilCount; i += 1) {
    const playerId = remainingCivilPlayers[i];
    const role =
      i < civilRolePool.length
        ? civilRolePool[i]
        : randomChoice(civilRoles, rng.next);
    roleByPlayer.set(playerId, role);
  }

  const players: Record<string, PlayerState> = {};
  const log = createEmptyLogState();

  const heroRolesPresent = new Set<RoleKey>();
  const civilRolesPresent = new Set<RoleKey>();

  for (const rp of roomPlayers) {
    const role = roleByPlayer.get(rp.id) ?? "weakling";
    let team: Team;
    let side: Side;

    if (role === "mawang_fear" || role === "mawang_troll") {
      team = "evil";
      side = "evil";
    } else if (role === "aide" || role === "fallen") {
      team = "evil";
      side = "traitor";
    } else if (
      role === "parryman" ||
      role === "slayer" ||
      role === "sage" ||
      role === "healer"
    ) {
      team = "good";
      side = "hero";
      heroRolesPresent.add(role);
    } else {
      // 시민
      team = "good";
      side = "civil";
      civilRolesPresent.add(role);
    }

    const isWeakling = role === "weakling";
    const hp = isWeakling ? 2 : 3;

    const hand: CardInstance[] = [];
    const firstType = randomCardType(rng.next);
    hand.push(createCard(firstType, nowMs));

    // 현자: 돋보기를 뽑으면 한 장 추가
    if (role === "sage" && firstType === "magnifier") {
      hand.push(createCard("magnifier", nowMs));
    }

    players[rp.id] = {
      identity: {
        playerId: rp.id,
        nickname: rp.nickname,
      },
      alive: true,
      hp,
      role,
      team,
      side,
      hand,
      effects: [],
      cooldowns: [],
      knowledge: {
        knownByTarget: {},
      },
      fake: isWeakling
        ? {
            // 약골: 처음에는 항상 3으로 보이게 시작하고,
            // 이후 WEAKLING_FAKE_HP_TICK 타이머에서 표시만 출렁이게 한다.
            fakeHp: 3,
          }
        : {},
    };
  }

  // 악의 하수인에게 마왕 정체 / 레이드 정보 로그 + knowledge 세팅
  const mawangPlayer = players[mawangId];
  const heroRolesInGame = Array.from(heroRolesPresent);
  const civilRolesInGame = Array.from(civilRolesPresent);
  const allHeroesPresent = heroRoles.every((r) => heroRolesPresent.has(r));

  for (const rp of roomPlayers) {
    const ps = players[rp.id];
    if (!ps) continue;

    if (ps.role === "aide") {
      // 참모: 마왕 정체 + 용사 구성
      // - 모든 용사 역할이 존재하면 시민 구성도 함께 알려준다.
      appendLog(log, {
        atMs: nowMs,
        type: "PERSONAL_AIDE_HERO_LIST",
        audience: { kind: "player", playerId: ps.identity.playerId },
        payload: {
          mawangPlayerId: mawangPlayer.identity.playerId,
          mawangNickname: mawangPlayer.identity.nickname,
          heroRolesInGame,
          civilRolesInGame: allHeroesPresent ? civilRolesInGame : [],
        },
        modal: true,
      });

      // 참모는 마왕의 팀/역할 정보를 사전에 알고 있다.
      const prev = ps.knowledge.knownByTarget[mawangPlayer.identity.playerId] ?? [];
      ps.knowledge.knownByTarget[mawangPlayer.identity.playerId] = [
        ...prev,
        {
          kind: "team",
          team: mawangPlayer.team,
          obtainedAtMs: nowMs,
          by: "skill",
        } as any,
        {
          kind: "role",
          role: mawangPlayer.role,
          obtainedAtMs: nowMs,
          by: "skill",
        } as any,
      ];
    } else if (ps.role === "fallen") {
      // 타락자: 마왕 정체만 알고 시작 (용사 구성은 모름)
      appendLog(log, {
        atMs: nowMs,
        type: "PERSONAL_AIDE_HERO_LIST",
        audience: { kind: "player", playerId: ps.identity.playerId },
        payload: {
          mawangPlayerId: mawangPlayer.identity.playerId,
          mawangNickname: mawangPlayer.identity.nickname,
          heroRolesInGame: [],
        },
        modal: true,
      });

      // 타락자도 마왕의 팀/역할 정보를 사전에 알고 있다.
      const prev = ps.knowledge.knownByTarget[mawangPlayer.identity.playerId] ?? [];
      ps.knowledge.knownByTarget[mawangPlayer.identity.playerId] = [
        ...prev,
        {
          kind: "team",
          team: mawangPlayer.team,
          obtainedAtMs: nowMs,
          by: "skill",
        } as any,
        {
          kind: "role",
          role: mawangPlayer.role,
          obtainedAtMs: nowMs,
          by: "skill",
        } as any,
      ];
    }
  }

  // 정신병자 fake role/team/side 설정 (보여지는 용사 역할)
  const heroRoleArray = Array.from(heroRolesPresent);
  for (const p of Object.values(players)) {
    if (p.role === "madman") {
      const fakeHero =
        heroRoleArray.length > 0
          ? randomChoice(heroRoleArray, rng.next)
          : randomChoice(
              ["parryman", "slayer", "sage", "healer"] as RoleKey[],
              rng.next,
            );
      p.fake.fakeRole = fakeHero;
      p.fake.fakeTeam = "good";
      p.fake.fakeSide = "hero";
      // 간단히 해당 스킬의 쿨다운 하나만 표시용으로 넣어준다.
      const skillKeyMap: Record<RoleKey, string> = {
        parryman: "parry_shield",
        slayer: "slayer_ult",
        sage: "healer_heal", // 표시용, 실제 효과는 없음
        healer: "healer_heal",
        mawang_fear: "mawang_fear",
        mawang_troll: "mawang_mask",
        aide: "traitor_beer",
        fallen: "traitor_beer",
        weakling: "healer_heal",
        coward: "healer_heal",
        madman: "healer_heal",
        experiment_host: "healer_heal",
      } as any;
      const sk = skillKeyMap[fakeHero] ?? "healer_heal";
      p.fake.fakeCooldowns = [
        {
          skillKey: sk as any,
          readyAtMs: nowMs,
        },
      ];
    }
  }

  const snapshot: GameSnapshot = {
    schemaVersion: 1,
    ids: {
      roomId,
      gameId: gameRow.id,
      seq: gameRow.seq,
    },
    meta: {
      state: "running",
      createdAtMs: nowMs,
      startedAtMs: nowMs,
      snapshotVersion: 1,
    },
    settings,
    rng: {
      seed: rngSeed,
      counter: rng.getCounter(),
    },
    timers: {
      nowMs,
      nextDrawAtMs: nowMs + settings.drawIntervalSec * 1000,
    },
    seating,
    players,
    log,
  };

  return snapshot;
}

