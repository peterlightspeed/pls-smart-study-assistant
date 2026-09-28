// Runtime configuration. Nothing here is secret: the Supabase anon key is public by design
// (data access is protected by the backend JWT check and Row Level Security).
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);

export const CONFIG = Object.freeze({
  API_ORIGIN: isLocal ? "http://localhost:8000" : "https://YOUR-BACKEND.onrender.com",
  API_PREFIX: "/api/v1",
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-PUBLIC-ANON-KEY",
});
