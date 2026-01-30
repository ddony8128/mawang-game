// Effect / Cooldown / Knowledge / Log 관련 타입
// 문서: document/ServerStateModel 5~7, 9

import type { SkillKey, Team } from "./identity";

export type EffectVisibility = "public" | "self" | "self_hidden" | "none";

export type EffectKind =
  | "bomb"
  | "feared"
  | "shield"
  | "trollStubborn"
  | "fearReviveUsed"
  | "slayerUltUsed"
  | "beerGuaranteed"
  | "fakeHpTick";

export type EffectBase = {
  id: string;
  kind: EffectKind;
  createdAtMs: number;
  expiresAtMs?: number;
  visibility: EffectVisibility;
  source?: {
    byPlayerId?: string;
    byCardId?: string;
    bySkillKey?: SkillKey;
  };
};

export type BombEffect = EffectBase & {
  kind: "bomb";
  payload: {
    plantedBy: string; // PlayerId
    explodeAtMs: number;
    damage: 2;
  };
};

export type FearedEffect = EffectBase & {
  kind: "feared";
  payload: {
    by: string; // PlayerId
    untilMs: number;
  };
};

export type ShieldEffect = EffectBase & {
  kind: "shield";
  payload: {
    untilMs: number;
  };
};

export type TrollStubbornEffect = EffectBase & {
  kind: "trollStubborn";
  payload: {
    untilMs: number;
    triggeredAtMs: number;
  };
};

export type FearReviveUsedEffect = EffectBase & {
  kind: "fearReviveUsed";
  payload: { used: true };
};

export type SlayerUltUsedEffect = EffectBase & {
  kind: "slayerUltUsed";
  payload: { used: true };
};

export type BeerGuaranteedEffect = EffectBase & {
  kind: "beerGuaranteed";
  payload: {
    forNextDrawAtMs: number;
  };
};

export type FakeHpTickEffect = EffectBase & {
  kind: "fakeHpTick";
  payload: {
    tickAtMs: number;
  };
};

export type Effect =
  | BombEffect
  | FearedEffect
  | ShieldEffect
  | TrollStubbornEffect
  | FearReviveUsedEffect
  | SlayerUltUsedEffect
  | BeerGuaranteedEffect
  | FakeHpTickEffect;

// 쿨다운
export type CooldownItem = {
  skillKey: SkillKey;
  readyAtMs: number;
};

// Knowledge (서버 쪽 이름: KnowRole)
export type KnowRole =
  | {
      kind: "team";
      team: Team;
      obtainedAtMs: number;
      by: "magnifier2" | "skill";
    }
  | {
      kind: "role";
      role: string;
      obtainedAtMs: number;
      by: "magnifier3" | "skill";
    };

// 로그/모달 시스템
export type LogAudience =
  | { kind: "global" }
  | { kind: "team"; team: Team }
  | { kind: "player"; playerId: string };

export type LogTypeGlobal =
  | "GLOBAL_FEAR_REVIVE_TRIGGERED"
  | "GLOBAL_TROLL_STUBBORN_TRIGGERED"
  | "GLOBAL_SLAYER_ULT_USED";

export type LogTypePersonal =
  | "PERSONAL_DIED"
  | "PERSONAL_SKILL_USED"
  | "PERSONAL_CARD_USED"
  | "PERSONAL_HIT_BY_KNIFE"
  | "PERSONAL_BOMB_PLANTED_ON_ME"
  | "PERSONAL_BOMB_EXPLODED_ON_ME"
  | "PERSONAL_CARD_GIVEN"
  | "PERSONAL_CARD_RECEIVED"
  | "PERSONAL_COWARD_CARD_FAILED"
  | "PERSONAL_AIDE_HERO_LIST";

export type LogTypeTeam = "EVIL_TEAM_EXPERIMENT_HOST_DIED_BONUS";

export type LogType = LogTypeGlobal | LogTypePersonal | LogTypeTeam;

export type LogItem = {
  id: string;
  seq: number;
  atMs: number;
  type: LogType;
  audience: LogAudience;
  payload: Record<string, any>;
  modal: boolean;
};

export type GameLogState = {
  lastSeq: number;
  items: LogItem[];
};

