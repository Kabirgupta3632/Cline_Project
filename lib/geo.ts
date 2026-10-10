// Geo math helpers: haversine distance, ETA estimation, PostGIS point helpers.
// Shared infra used by sos (radius), dispatch (eta), and inventory (mesh) features.
import type { LatLng } from "./types";

const EARTH_RADIUS_KM = 6371;

/** Convert degrees to radians. */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two lat/lng points in kilometers (haversine).
 * Used both client-side (display) and server-side (as a fallback / sanity
 * check next to PostGIS ST_Distance in SQL RPCs).
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

/** Default assumptions for ETA calculation, overridable via env for the demo. */
export const DEFAULT_AVG_SPEED_KMH = Number(
  process.env.NEXT_PUBLIC_AVG_SPEED_KMH ?? process.env.AVG_SPEED_KMH ?? 25
);
export const ETA_BUFFER_MIN = Number(process.env.ETA_BUFFER_MIN ?? 2);

/**
 * Estimated time of arrival in whole minutes: distance / avg urban speed,
 * plus a fixed buffer (rule 7). Recomputed on every donor location ping.
 */
export function estimateEtaMinutes(
  distanceKm: number,
  avgSpeedKmh: number = DEFAULT_AVG_SPEED_KMH,
  bufferMin: number = ETA_BUFFER_MIN
): number {
  if (distanceKm <= 0) return bufferMin;
  const travelMinutes = (distanceKm / avgSpeedKmh) * 60;
  return Math.ceil(travelMinutes + bufferMin);
}

/** Converts a plain LatLng into a PostGIS "POINT(lng lat)" WKT literal. */
export function toWktPoint({ lat, lng }: LatLng): string {
  return `POINT(${lng} ${lat})`;
}

/** Radius escalation ladder for critical SOS requests (rule 3). */
export const NORMAL_RADIUS_KM = 5;
export const CRITICAL_START_RADIUS_KM = 15;
export const CRITICAL_RADIUS_STEP_KM = 10;
export const CRITICAL_MAX_RADIUS_KM = 50;

/** Seconds between each automatic radius widening step, demo-overridable. */
export const DEMO_ESCALATION_SECONDS = Number(
  process.env.DEMO_ESCALATION_SECONDS ?? process.env.NEXT_PUBLIC_DEMO_ESCALATION_SECONDS ?? 300
);

/**
 * Given how many escalation steps have elapsed since a critical SOS was
 * created, compute the current search radius (capped at 50km).
 */
export function escalatedRadiusKm(stepsElapsed: number): number {
  const radius =
    CRITICAL_START_RADIUS_KM + stepsElapsed * CRITICAL_RADIUS_STEP_KM;
  return Math.min(radius, CRITICAL_MAX_RADIUS_KM);
}

/**
 * Given the created_at timestamp of a critical SOS, compute how many
 * escalation steps have elapsed (using DEMO_ESCALATION_SECONDS as the step
 * duration) and the resulting radius right now.
 */
export function currentEscalatedRadius(createdAt: string | Date): {
  stepsElapsed: number;
  radiusKm: number;
} {
  const createdMs = new Date(createdAt).getTime();
  const elapsedSec = Math.max(0, (Date.now() - createdMs) / 1000);
  const stepsElapsed = Math.floor(elapsedSec / DEMO_ESCALATION_SECONDS);
  return { stepsElapsed, radiusKm: escalatedRadiusKm(stepsElapsed) };
}
