import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export function getGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error("Falha na troca do code: " + (await res.text()).slice(0, 200));
  return (await res.json()) as TokenResponse;
}

export async function saveGoogleTokens(
  userId: string,
  email: string | null,
  tokens: TokenResponse
): Promise<void> {
  const supabase = await createClient();
  const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();
  const row: Record<string, unknown> = {
    user_id: userId,
    email,
    access_token: tokens.access_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };
  if (tokens.refresh_token) row.refresh_token = tokens.refresh_token;
  await supabase.from("google_calendar_tokens").upsert(row, { onConflict: "user_id" });
}

export async function isGoogleConnected(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("google_calendar_tokens")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

async function getValidAccessToken(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("google_calendar_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;

  if (data.expires_at && new Date(data.expires_at as string) > new Date()) {
    return data.access_token as string;
  }
  if (!data.refresh_token) return null;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: data.refresh_token as string,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    log.error("[Google] refresh falhou: " + (await res.text()).slice(0, 150));
    return null;
  }
  const t = (await res.json()) as TokenResponse;
  const expiresAt = new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString();
  await supabase
    .from("google_calendar_tokens")
    .update({ access_token: t.access_token, expires_at: expiresAt })
    .eq("user_id", userId);
  return t.access_token;
}

/**
 * Cria um evento de dia inteiro na agenda principal do usuario.
 * `date` no formato AAAA-MM-DD.
 */
export async function createCalendarEvent(
  userId: string,
  ev: { summary: string; description?: string; date: string },
  calendarId: string = "primary"
): Promise<{ ok: true } | { error: string }> {
  const token = await getValidAccessToken(userId);
  if (!token) return { error: "not_connected" };

  const end = new Date(ev.date + "T00:00:00");
  end.setDate(end.getDate() + 1);
  const endStr = end.toISOString().slice(0, 10);

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: ev.summary,
      description: ev.description || "",
      start: { date: ev.date },
      end: { date: endStr },
      reminders: { useDefault: true },
    }),
  });
  if (!res.ok) return { error: "Falha ao criar evento: " + (await res.text()).slice(0, 150) };
  return { ok: true };
}

/** Lista as agendas em que o usuario pode ESCREVER (a dele + as compartilhadas). */
export async function listCalendars(
  userId: string
): Promise<{ id: string; summary: string }[]> {
  const token = await getValidAccessToken(userId);
  if (!token) return [];
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: { id: string; summary: string; summaryOverride?: string; accessRole: string; primary?: boolean }[];
  };
  return (data.items ?? [])
    .filter((c) => c.accessRole === "owner" || c.accessRole === "writer")
    .map((c) => ({ id: c.id, summary: (c.primary ? "Minha agenda" : c.summaryOverride || c.summary) }));
}

/** Proximos eventos da agenda principal do usuario (para importar reunioes). */
export async function listUpcomingEvents(
  userId: string,
  max = 20
): Promise<{ id: string; summary: string; date: string }[]> {
  const token = await getValidAccessToken(userId);
  if (!token) return [];
  const timeMin = new Date().toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=${max}&singleEvents=true&orderBy=startTime`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: { id: string; summary?: string; start?: { dateTime?: string; date?: string } }[];
  };
  return (data.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary || "(sem titulo)",
    date: e.start?.dateTime || e.start?.date || "",
  }));
}
