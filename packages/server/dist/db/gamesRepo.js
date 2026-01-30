"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGameForRoom = createGameForRoom;
const crypto_1 = __importDefault(require("crypto"));
const supabase_1 = require("./supabase");
async function createGameForRoom(params) {
    const gameId = crypto_1.default.randomUUID();
    // 간단한 RNG 시드: 안전성이 크게 중요하지 않으므로 Date 기반 + 랜덤값 사용
    const rngSeed = BigInt(Date.now()) ^ BigInt(crypto_1.default.randomInt(1, 1e9));
    // 같은 방에서 여러 판을 지원하기 위해
    // room_id 기준으로 seq 의 다음 값을 계산한다.
    let nextSeq = 1;
    try {
        const { data: rows, error: selectError } = await supabase_1.supabase
            .from("games")
            .select("seq")
            .eq("room_id", params.roomId)
            .order("seq", { ascending: false })
            .limit(1);
        if (!selectError && rows && rows.length > 0) {
            const lastSeq = typeof rows[0].seq === "number" ? rows[0].seq : 0;
            nextSeq = lastSeq + 1;
        }
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("[supabase][createGameForRoom] failed to load last seq:", err);
        // 실패 시에는 그냥 1로 둔다.
    }
    const { data, error } = await supabase_1.supabase
        .from("games")
        .insert({
        id: gameId,
        room_id: params.roomId,
        seq: nextSeq,
        state: "running",
        rng_seed: rngSeed.toString(), // BIGINT 로 저장
        settings: params.settings,
        snapshot: {},
        snapshot_version: 0,
    })
        .select("*")
        .single();
    if (error) {
        // eslint-disable-next-line no-console
        console.error("[supabase][createGameForRoom] error:", error);
        throw error;
    }
    return data;
}
