import { createClient } from "@supabase/supabase-js";

// Vite에서 VITE_ 접두사가 붙은 값만 브라우저에 전달됩니다.
// 여기에는 공개 사용이 허용된 publishable key만 사용하며 secret/service_role 키는 절대 넣지 않습니다.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;
