// 서버 전용 식별/역할/팀 관련 타입들
// 문서: document/ServerStateModel 의 12. RoleKey, 6. Cooldown 모델 참고

export type Team = "good" | "evil";

export type Side = "hero" | "civil" | "evil" | "traitor";

// 서버 내부에서 사용하는 역할 키
export type RoleKey =
  | "mawang_fear" // 공포의 마왕
  | "mawang_troll" // 분탕의 마왕
  | "aide" // 참모
  | "fallen" // 타락자
  | "parryman" // 패링맨
  | "slayer" // 슬레이어
  | "sage" // 현자
  | "healer" // 힐러
  | "weakling" // 약골
  | "coward" // 겁쟁이
  | "madman" // 정신병자
  | "experiment_host"; // 실험체

// 능력(스킬) 키
export type SkillKey =
  | "mawang_fear" // 겁주기
  | "mawang_mask" // 가면놀이(1회)
  | "traitor_beer" // 술자리 권유
  | "parry_shield" // 무적방패
  | "slayer_ult" // 짱쎈 필살기(1회)
  | "healer_heal"; // 회복 마법

