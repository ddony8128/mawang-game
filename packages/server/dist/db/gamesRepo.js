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
    const { data, error } = await supabase_1.supabase
        .from("games")
        .insert({
        id: gameId,
        room_id: params.roomId,
        seq: params.seq,
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
