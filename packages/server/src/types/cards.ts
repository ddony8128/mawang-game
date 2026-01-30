// 카드 관련 타입
// 문서: document/ServerStateModel 4.1 카드 인스턴스

export type CardType = "magnifier" | "knife" | "bomb" | "beer";

export type CardInstance = {
  id: string; // UUID
  type: CardType;
  createdAtMs: number;
};

