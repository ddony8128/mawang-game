// 카드 타입 (클라이언트용)
// 서버의 CardType/CardInstance 와 1:1 로 대응

export type CardType = "magnifier" | "knife" | "bomb" | "beer";

export type CardInstance = {
  id: string;
  type: CardType;
  createdAtMs: number;
};

