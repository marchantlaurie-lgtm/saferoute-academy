// uk-weather-map.jsx
// Embeddable RainViewer radar map for Academy's UK tab. Free, keyless API —
// see https://www.rainviewer.com/api.html. Requires attribution link per
// their terms, included in the footer below.
//
// Uses Leaflet directly. Install dependency: npm install leaflet

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const RAINVIEWER_API_URL = 'https://api.rainviewer.com/public/weather-maps.json';
const TILE_SIZE = 256;
const RADAR_OPACITY = 0.7;

/**
 * @param {object} props
 * @param {number} props.centerLat
 * @param {number} props.centerLon
 * @param {number} [props.zoom]
 * @param {string} [props.airfieldLabel] - e.g. "Kemble (EGBP)" — shown as a marker popup
 */
export function UkWeatherMap({ centerLat, centerLon, zoom = 7, airfieldLabel }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const radarLayerRef = useRef(null);

  const [frames, setFrames] = useState([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // ---- Fetch available frames ----
  useEffect(() => {
    let cancelled = false;

    fetch(RAINVIEWER_API_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`RainViewer API returned ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const pastFrames = data.radar?.past ?? [];
        if (pastFrames.length === 0) {
          setLoadError('No radar frames available right now.');
          return;
        }
        setFrames(pastFrames);
        setFrameIndex(pastFrames.length - 1); // default to most recent
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'Could not load weather map.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Init map (once) ----
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLon],
      zoom,
      scrollWheelZoom: false, // avoid hijacking page scroll inside a card
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors | Radar: <a href="https://www.rainviewer.com/">RainViewer</a>',
      maxZoom: 12,
    }).addTo(map);

    if (airfieldLabel) {
      L.marker([centerLat, centerLon]).addTo(map).bindPopup(airfieldLabel).openPopup();
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Update radar layer when frame changes ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || frames.length === 0) return;

    const frame = frames[frameIndex];
    if (!frame) return;

    const tileUrl = `https://tilecache.rainviewer.com${frame.path}/${TILE_SIZE}/{z}/{x}/{y}/2/1_1.png`;

    if (radarLayerRef.current) {
      map.removeLayer(radarLayerRef.current);
    }

    const layer = L.tileLayer(tileUrl, {
      opacity: RADAR_OPACITY,
      zIndex: 10,
    });
    layer.addTo(map);
    radarLayerRef.current = layer;
  }, [frames, frameIndex]);

  // ---- Simple play/pause animation through past frames ----
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;

    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, 600);

    return () => clearInterval(interval);
  }, [isPlaying, frames.length]);

  const currentFrameTime = frames[frameIndex]
    ? new Date(frames[frameIndex].time * 1000).toUTCString()
    : null;

  return (
    <div className="uk-weather-map">
      <div ref={mapContainerRef} style={{ height: 320, width: '100%', borderRadius: 8 }} />

      {loadError && (
        <p className="uk-weather-map__error">{loadError}</p>
      )}

      {!loadError && frames.length > 0 && (
        <div className="uk-weather-map__controls">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            aria-label={isPlaying ? 'Pause radar animation' : 'Play radar animation'}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={frameIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setFrameIndex(Number(e.target.value));
            }}
            aria-label="Radar timeline"
          />

          {currentFrameTime && (
            <span className="uk-weather-map__timestamp">{currentFrameTime}</span>
          )}
        </div>
      )}

      <p className="uk-weather-map__attribution">
        Radar imagery from{' '}
        <a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">
          RainViewer
        </a>
        . Not a substitute for the Met Office Aviation Briefing Service — check{' '}
        <a href="https://mavis.metoffice.gov.uk/" target="_blank" rel="noreferrer">
          MAVIS
        </a>{' '}
        for regulated TAFs, SIGMETs, and F215 charts before flight.
      </p>
    </div>
  );
}
