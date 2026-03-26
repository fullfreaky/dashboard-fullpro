const API_URL = "https://tlpdeadzebrnqufagygd.supabase.co/functions/v1/dashboard-api";

export async function fetchDashboard(queries) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
