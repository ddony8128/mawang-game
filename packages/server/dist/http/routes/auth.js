"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const crypto_1 = __importDefault(require("crypto"));
const express_1 = require("express");
const supabase_1 = require("../../db/supabase");
const apiResponse_1 = require("../apiResponse");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post("/", async (req, res) => {
    const headerDeviceId = req.header("x-device-id") ?? req.header("X-Device-Id");
    const bodyDeviceId = typeof req.body?.deviceId === "string" ? req.body.deviceId : null;
    const baseDeviceId = headerDeviceId || bodyDeviceId;
    const deviceId = baseDeviceId && baseDeviceId.length > 0
        ? baseDeviceId
        : crypto_1.default.randomUUID();
    // 최근 방/게임 재접속 가능 여부 조회
    let reconnect = {
        available: false,
        roomId: null,
        gameId: null,
        roomTitle: null,
        phase: null,
        note: null,
    };
    try {
        const { data: rpRows, error: rpError } = await supabase_1.supabase
            .from("room_players")
            .select("room_id, created_at, is_in_room")
            .eq("device_id", deviceId)
            .eq("is_in_room", true)
            .order("created_at", { ascending: false })
            .limit(1);
        if (!rpError && rpRows && rpRows.length > 0) {
            const roomId = rpRows[0].room_id;
            const { data: room, error: roomError } = await supabase_1.supabase
                .from("rooms")
                .select("id,title,phase")
                .eq("id", roomId)
                .single();
            if (roomError) {
                // eslint-disable-next-line no-console
                console.error("[supabase][auth rooms] error:", roomError);
            }
            else if (room) {
                // 재접속은 "게임 중인 방" 에 대해서만 허용한다.
                if (room.phase === "game") {
                    // 다만, 실제 게임이 종료된 상태라면 메인 화면에서 대기실로 이동해야 하므로
                    // 마지막 게임 state 를 확인해 running/ended 를 구분한다.
                    let reconnectPhase = "game";
                    try {
                        const { data: gameRows, error: gameError } = await supabase_1.supabase
                            .from("games")
                            .select("state")
                            .eq("room_id", room.id)
                            .order("seq", { ascending: false })
                            .limit(1);
                        if (gameError) {
                            // eslint-disable-next-line no-console
                            console.error("[supabase][auth games] error:", gameError);
                        }
                        else if (gameRows && gameRows.length > 0) {
                            const lastState = gameRows[0].state;
                            // running 이 아니면(ended/aborted) 클라이언트는 대기실로 보내기 위해 phase 를 lobby 로 내려준다.
                            if (lastState !== "running") {
                                reconnectPhase = "lobby";
                            }
                        }
                    }
                    catch (errGames) {
                        // eslint-disable-next-line no-console
                        console.error("[authRouter] unexpected games query error:", errGames);
                    }
                    reconnect = {
                        available: true,
                        roomId: room.id,
                        gameId: null,
                        roomTitle: room.title,
                        phase: reconnectPhase,
                        note: null,
                    };
                }
                else {
                    // lobby/closed 등은 재접속 대상에서 제외
                    reconnect = {
                        available: false,
                        roomId: null,
                        gameId: null,
                        roomTitle: null,
                        phase: null,
                        note: null,
                    };
                }
            }
        }
        else if (rpError) {
            // eslint-disable-next-line no-console
            console.error("[supabase][auth room_players] error:", rpError);
        }
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("[authRouter] unexpected error:", err);
    }
    (0, apiResponse_1.sendOk)(res, {
        deviceId,
        reconnect,
    });
});
