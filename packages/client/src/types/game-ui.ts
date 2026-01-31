// 프론트엔드 전용 인게임 UI용 타입 (서버 FoggedGameState 와는 별도)

export type UiTeam = "good" | "evil" | "citizen";

export type UiCardType = "sword" | "magnifier" | "bomb" | "beer";

export type UiCard = {
  id: string;
  type: UiCardType;
  name: string;
  description: string;
};

export type UiAbility = {
  id: string;
  name: string;
  description: string;
  cooldown: number; // seconds
  lastUsedAt?: number; // ms
  used?: boolean; // 1회성 스킬 등 영구 사용 여부
};

export type UiPlayerStatus = {
  // 나에게 설치된 폭탄들 (여러 개 가능)
  bombs?: Array<{ id: string; remainingSeconds: number; damage: number }>;
  isIntimidated?: { remainingSeconds: number };
  isInvincible?: { remainingSeconds: number };
  // 분탕의 집념(일시 부활) 상태
  trollStubborn?: { remainingSeconds: number };
};

export type UiKnownInfo = {
  [playerId: string]: {
    team?: UiTeam;
    roleName?: string;
    roleKey?: string;
  };
};

export type UiRole = {
  id: string;
  name: string;
  team: UiTeam;
  abilities: UiAbility[];
};

export type UiPlayer = {
  id: string;
  nickname: string;
  hp: number;
  maxHp: number;
  isDead: boolean;
  role?: UiRole;
  hand: UiCard[];
  status: UiPlayerStatus;
  knownInfo: UiKnownInfo;
};

export type UiGameEventType =
  | "card_draw"
  | "damage"
  | "card_use"
  | "card_transfer"
  | "heal"
  | "bomb"
  | "ability_use";

export type UiGameEvent = {
  id: string;
  timestamp: number;
  type: UiGameEventType;
  message: string;
};

export type UiGameSettings = {
  cardDrawInterval: number;
  bombTimer: number;
  handLimit: number;
  fearKingReviveHp: number;
  chaosKingPersistTime: number;
  teamCounts?: {
    traitor: number;
    hero: number;
    civil: number;
  };
};

export type UiGameState = {
  roomId: string;
  myPlayerId: string;
  nextCardDrawInSeconds: number;
  gamePhase: "playing" | "ended";
  settings: UiGameSettings;
  eventLog: UiGameEvent[];
  players: UiPlayer[];
};

