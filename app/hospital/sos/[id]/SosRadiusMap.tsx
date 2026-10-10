// Leaflet/OpenStreetMap mini-map: hospital pin + a radius circle that visibly
// grows as a critical SOS escalates. Feature: Hospital UI (Person 2).
"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/types";

// Leaflet's default marker icons reference image files via relative URLs that
// break under Next.js bundling - rebuild the default icon from the CDN so the
// pin actually renders instead of showing a broken image.
const hospitalIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** Keeps the map view centered + zoomed to fit the radius circle whenever it grows. */
function FitToRadius({ center, radiusKm }: { center: [number, number]; radiusKm: number }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLng(center).toBounds(radiusKm * 1000 * 2.2);
    map.fitBounds(bounds, { animate: true });
  }, [map, center, radiusKm]);
  return null;
}

export interface SosRadiusMapProps {
  hospitalLocation: LatLng;
  radiusKm: number;
  hospitalName?: string;
  urgency: "normal" | "critical";
}

/**
 * Renders a small OpenStreetMap view (no API key required) with the hospital
 * pin and a circle sized to the SOS's current search radius_km. The circle
 * grows automatically on re-render whenever radius_km increases (critical
 * escalation, rule 3), since the parent page already polls /api/sos/[id].
 */
export default function SosRadiusMap({
  hospitalLocation,
  radiusKm,
  hospitalName,
  urgency,
}: SosRadiusMapProps) {
  const center: [number, number] = [hospitalLocation.lat, hospitalLocation.lng];
  const circleColor = urgency === "critical" ? "#d90429" : "#e01e1e";

  return (
    <div className="h-64 w-full overflow-hidden rounded-xl border border-gray-200 shadow-card">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={center} icon={hospitalIcon}>
          <Popup>{hospitalName ?? "Hospital"}</Popup>
        </Marker>
        <Circle
          center={center}
          radius={radiusKm * 1000}
          pathOptions={{ color: circleColor, fillColor: circleColor, fillOpacity: 0.12 }}
        />
        <FitToRadius center={center} radiusKm={radiusKm} />
      </MapContainer>
    </div>
  );
}
