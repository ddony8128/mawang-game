"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
require("dotenv/config");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !supabaseKey) {
    // 개발/테스트 환경에서 env 누락 시 빨리 알 수 있도록 콘솔에 경고를 남긴다.
    // (실제 런타임에서는 프로세스가 바로 죽도록 해도 된다.)
    // eslint-disable-next-line no-console
    console.warn("[supabase] SUPABASE_URL / SUPABASE_SERVICE_KEY 환경 변수가 설정되지 않았습니다.");
}
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl ?? "", supabaseKey ?? "");
