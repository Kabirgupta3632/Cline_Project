// Geo-utility helpers: haversine distance and ETA calculation
// Feature: Dispatch / SOS Matching – used by dispatch ETA and matching logic

import type { GeoPoint } from './types';

const EARTH_RADIUS_KM = 6371;

/**
 * Haversine distance between two lat/lng points, in kilometres.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const haversine =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

/**
 * Compute ETA in minutes given a straight-line distance (km).
 * Assumes urban travel speed (default 25 km/h) + 2-minute buffer.
 * Speed is configurable via NEXT_PUBLIC_AVG_SPEED_KMH env var.
 */
export function etaMinutes(distanceKm: number): number {
  const speedKmh =
    Number(process.env.NEXT_PUBLIC_AVG_SPEED_KMH ?? 25) || 25;
  const travelMinutes = (distanceKm / speedKmh) * 60;
  return Math.ceil(travelMinutes) + 2; // +2 min buffer
}

/**
 * Returns true if two points are considered "not moving"
 * (distance < 50 m between pings).
 */
export function isStationary(a: GeoPoint, b: GeoPoint): boolean {
  return haversineKm(a, b) < 0.05; // 50 metres threshold
}
