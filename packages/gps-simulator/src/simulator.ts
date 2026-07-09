/* eslint-disable no-console */
import { readFileSync } from 'fs';
import { resolve } from 'path';

import axios from 'axios';

interface Waypoint {
  lat: number;
  lng: number;
}

interface StopAt {
  waypointIndex: number;
  durationSeconds: number;
}

interface Route {
  deviceId: string;
  token: string;
  intervalSeconds: number;
  speed: number;
  waypoints: Waypoint[];
  stopsAt?: StopAt[];
}

interface SimulatorConfig {
  apiUrl: string;
  routes: Route[];
}

function loadConfig(configPath: string): SimulatorConfig {
  const raw = readFileSync(resolve(configPath), 'utf-8');
  return JSON.parse(raw) as SimulatorConfig;
}

function calculateHeading(from: Waypoint, to: Waypoint): number {
  const dLng = to.lng - from.lng;
  const dLat = to.lat - from.lat;
  const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
  return (angle + 360) % 360;
}

function sleep(seconds: number): Promise<void> {
  return new Promise((res) => setTimeout(res, seconds * 1000));
}

async function sendPoint(
  apiUrl: string,
  token: string,
  deviceId: string,
  waypoint: Waypoint,
  heading: number | null,
  speed: number,
  label: string,
): Promise<void> {
  const payload = {
    deviceId,
    lat: waypoint.lat,
    lng: waypoint.lng,
    speed: Math.round(speed),
    heading: heading !== null ? Math.round(heading) : null,
    accuracy: 5,
    timestamp: new Date().toISOString(),
  };

  try {
    await axios.post(`${apiUrl}/api/tracking/gps`, payload, {
      headers: { Authorization: `Bearer ${token}`, 'X-Device-Id': deviceId },
    });
    console.log(`[${deviceId}] ${label} lat=${waypoint.lat}, lng=${waypoint.lng}`);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(`[${deviceId}] Error ${err.response?.status ?? 'sin respuesta'}: ${err.message}`);
    } else {
      console.error(`[${deviceId}] Error inesperado al enviar punto`);
    }
  }
}

async function runRoute(route: Route, apiUrl: string): Promise<void> {
  const { deviceId, token, intervalSeconds, speed, waypoints, stopsAt = [] } = route;
  const stopMap = new Map(stopsAt.map((s) => [s.waypointIndex, s.durationSeconds]));

  console.log(`[${deviceId}] Iniciando ruta: ${waypoints.length} waypoints, intervalo: ${intervalSeconds}s`);

  for (let i = 0; i < waypoints.length; i++) {
    const waypoint = waypoints[i];
    const next = waypoints[i + 1];
    const heading = next ? calculateHeading(waypoint, next) : null;

    await sendPoint(apiUrl, token, deviceId, waypoint, heading, speed, `[${i + 1}/${waypoints.length}]`);

    const stopDuration = stopMap.get(i);
    if (stopDuration !== undefined) {
      const extraPoints = Math.floor(stopDuration / intervalSeconds);
      console.log(`[${deviceId}] Parada en waypoint ${i + 1} por ${stopDuration}s (${extraPoints} puntos extra)`);

      for (let j = 0; j < extraPoints; j++) {
        await sleep(intervalSeconds);
        await sendPoint(apiUrl, token, deviceId, waypoint, heading, 0, `[parada ${j + 1}/${extraPoints}]`);
      }
    }

    if (i < waypoints.length - 1) {
      await sleep(intervalSeconds);
    }
  }

  console.log(`[${deviceId}] Ruta finalizada.`);
}

async function run(): Promise<void> {
  const configPath = process.argv[2] ?? 'config/route-sample.json';
  const config = loadConfig(configPath);

  console.log(`Iniciando simulador: ${config.routes.length} vehículo(s)`);
  console.log('---');

  const results = await Promise.allSettled(
    config.routes.map((route) => runRoute(route, config.apiUrl)),
  );

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`[route ${i}] Falló: ${String(result.reason)}`);
    }
  });

  console.log('---');
  console.log('Simulación completa.');
}

void run();
