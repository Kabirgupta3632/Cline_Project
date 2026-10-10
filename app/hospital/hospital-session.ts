// Tiny localStorage-backed "session" for the Hospital role switcher (no real
// auth system - rule says auth is out of scope). Feature: Hospital UI (Person 2).
"use client";

const STORAGE_KEY = "raksharakt_hospital_id";
const STORAGE_NAME_KEY = "raksharakt_hospital_name";

export function getActiveHospitalId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function getActiveHospitalName(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_NAME_KEY);
}

export function setActiveHospital(id: string, name: string): void {
  window.localStorage.setItem(STORAGE_KEY, id);
  window.localStorage.setItem(STORAGE_NAME_KEY, name);
}

export function clearActiveHospital(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(STORAGE_NAME_KEY);
}
