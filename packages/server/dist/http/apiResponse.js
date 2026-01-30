"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOk = sendOk;
exports.sendError = sendError;
function sendOk(res, data) {
    res.json({ ok: true, data });
}
function sendError(res, code, message, status = 400) {
    const error = { code, message };
    res.status(status).json({ ok: false, error });
}
