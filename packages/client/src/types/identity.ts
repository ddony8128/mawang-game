// 클라이언트 전용 식별/역할/팀 관련 타입들
// 서버의 packages/server/src/types/identity.ts 와 개념적으로 동일하지만
// 배포는 완전히 분리된다.

export type Team = "good" | "evil";

export type Side = "hero" | "civil" | "evil" | "traitor";

export type RoleKey =
  | "mawang_fear"
  | "mawang_troll"
  | "aide"
  | "fallen"
  | "parryman"
  | "slayer"
  | "sage"
  | "healer"
  | "weakling"
  | "coward"
  | "madman"
  | "experiment_host";

export type SkillKey =
  | "mawang_fear"
  | "mawang_mask"
  | "traitor_beer"
  | "parry_shield"
  | "slayer_ult"
  | "healer_heal";

