// Tiny fetch wrapper that unwraps the {ok,data,error} envelope from lib/types.ts
// and never throws - callers get a typed result or a readable error string.
// Shared infra used by hospital/donor/demo client components.
import type { ApiResponse } from "./types";

export async function apiFetch<T>(
  url: string,
  init?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const json = (await res.json()) as ApiResponse<T>;
    if (!json.ok) {
      return { data: null, error: json.error };
    }
    return { data: json.data, error: null };
  } catch (err) {
    // Network failure / backend route not implemented yet / server not running.
    // Never throw - callers should show a friendly "unavailable" state instead
    // of crashing the demo.
    const message = err instanceof Error ? err.message : "Request failed";
    return { data: null, error: message };
  }
}

export function apiPost<T>(url: string, body: unknown) {
  return apiFetch<T>(url, { method: "POST", body: JSON.stringify(body) });
}

export function apiGet<T>(url: string) {
  return apiFetch<T>(url, { method: "GET" });
}
