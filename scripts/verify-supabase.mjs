import { createClient } from "@supabase/supabase-js";

// 이 검사는 publishable key를 사용하는 익명 브라우저와 같은 권한으로 실행됩니다.
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) throw new Error("Supabase 환경변수가 필요합니다.");

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const [levels, missions, rewards, profiles] = await Promise.all([
  client.from("green_levels").select("level_key"),
  client.from("missions").select("id"),
  client.from("rewards").select("id"),
  client.from("profiles").select("id"),
]);

for (const result of [levels, missions, rewards]) {
  if (result.error) throw result.error;
}

if (levels.data.length !== 4) throw new Error("GREEN LEVEL 샘플 데이터가 올바르지 않습니다.");
if (missions.data.length !== 1) throw new Error("미션 샘플 데이터가 올바르지 않습니다.");
if (rewards.data.length !== 6) throw new Error("리워드 샘플 데이터가 올바르지 않습니다.");
// profiles에는 anon GRANT 자체가 없으므로 빈 결과가 아니라 권한 오류가 반환되어야 안전합니다.
if (profiles.error?.code !== "42501") throw new Error("익명 profiles 조회가 권한 단계에서 차단되지 않았습니다.");

console.log("PASS: 공개 데이터 조회 및 익명 사용자 데이터 차단");
