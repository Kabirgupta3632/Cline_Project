// Tiny localStorage-backed "session" for the Donor role switcher (no real
// auth system - rule says auth is out of scope). Feature: Donor UI (Person 3).
"use client";

const STORAGE_KEY = "raksharakt_donor_id";
const STORAGE_NAME_KEY = "raksharakt_donor_name";
const STORAGE_GROUP_KEY = "raksharakt_donor_blood_group";

export function getActiveDonorId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function getActiveDonorName(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_NAME_KEY);
}

export function getActiveDonorBloodGroup(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_GROUP_KEY);
}

export function setActiveDonor(id: string, name: string, bloodGroup: string): void {
  window.localStorage.setItem(STORAGE_KEY, id);
  window.localStorage.setItem(STORAGE_NAME_KEY, name);
  window.localStorage.setItem(STORAGE_GROUP_KEY, bloodGroup);
}

export function clearActiveDonor(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(STORAGE_NAME_KEY);
  window.localStorage.removeItem(STORAGE_GROUP_KEY);
}
