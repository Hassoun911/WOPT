"use client";

import { useEffect, useMemo, useState } from "react";

const KAABA = { lat: 21.4225, lon: 39.8262 };

function toRad(value: number) { return (value * Math.PI) / 180; }
function toDeg(value: number) { return (value * 180) / Math.PI; }
function qiblaBearing(lat: number, lon: number) {
  const phi1 = toRad(lat);
  const phi2 = toRad(KAABA.lat);
  const deltaLon = toRad(KAABA.lon - lon);
  const y = Math.sin(deltaLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export default function QiblaPage() {
  const [location, setLocation] = useState<{lat:number; lon:number} | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) { setError("Location is not available in this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation({ lat: position.coords.latitude, lon: position.coords.longitude }),
      () => setError("Allow location access to calculate Qibla from where you are."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 }
    );

    const handler = (event: DeviceOrientationEvent) => {
      const ios = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
      if (typeof ios.webkitCompassHeading === "number") setHeading(ios.webkitCompassHeading);
      else if (typeof event.alpha === "number") setHeading((360 - event.alpha) % 360);
    };
    window.addEventListener("deviceorientationabsolute", handler as EventListener, true);
    window.addEventListener("deviceorientation", handler, true);
    return () => {
      window.removeEventListener("deviceorientationabsolute", handler as EventListener, true);
      window.removeEventListener("deviceorientation", handler, true);
    };
  }, []);

  const bearing = useMemo(() => location ? qiblaBearing(location.lat, location.lon) : null, [location]);
  const rotation = bearing === null ? 0 : bearing - (heading ?? 0);

  return <main className="parity-page">
    <section className="parity-hero">
      <div><div className="eyebrow">QIBLA DIRECTION</div><h1>Find the Qibla</h1><p>Uses your current browser location and, when available, your device compass.</p></div>
      <div className="hero-badge">🕋</div>
    </section>
    <section className="qibla-card">
      <div className="compass-shell"><div className="compass-ring" style={{ transform: `rotate(${rotation}deg)` }}><div className="qibla-arrow">▲</div><div className="kaaba-mark">🕋</div></div></div>
      <div className="qibla-readout">
        <strong>{bearing === null ? "Locating…" : `${Math.round(bearing)}°`}</strong>
        <span>{heading === null ? "Bearing from north" : `Turn ${Math.round(((rotation + 540) % 360) - 180)}° to align`}</span>
      </div>
      {error ? <p className="error-note">{error}</p> : null}
      <button className="primary-action" onClick={() => window.location.reload()}>Refresh location</button>
    </section>
  </main>;
}
