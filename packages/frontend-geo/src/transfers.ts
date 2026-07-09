import L from 'leaflet';
import type { TransferOutput, TransfersApiResponse } from './types';

const API_URL = import.meta.env.VITE_API_URL as string;
const POLL_INTERVAL_MS = 10_000;

export async function fetchTransfers(token: string): Promise<TransferOutput[]> {
  const res = await fetch(
    `${API_URL}/api/operaciones/traslados?status=IN_TRANSIT&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    console.error('Error al cargar traslados activos:', res.status);
    return [];
  }
  const body = (await res.json()) as TransfersApiResponse;
  return [...body.data.items];
}

function buildPopupHtml(transfer: TransferOutput): string {
  const alertRows =
    transfer.activeAlerts.length > 0
      ? transfer.activeAlerts
          .map((a) => `<li style="margin:2px 0;color:#c0392b">${a.type}: ${a.message}</li>`)
          .join('')
      : '<li style="margin:2px 0;color:#888">Sin alertas</li>';

  return `
    <strong style="font-size:13px">${transfer.conductor.name}</strong><br/>
    <span style="font-size:12px;color:#555">${transfer.vehicle.plate}</span><br/>
    <span style="font-size:12px">${transfer.origin} → ${transfer.destination}</span>
    <ul style="margin:6px 0 0;padding-left:16px;font-size:12px">${alertRows}</ul>
  `;
}

export function renderTransfers(
  map: L.Map,
  transfers: TransferOutput[],
  markerMap: Map<string, L.CircleMarker>,
): void {
  const seenIds = new Set<string>();

  for (const transfer of transfers) {
    const mostRecentAlert = transfer.activeAlerts[0];
    if (mostRecentAlert === undefined) {
      // No GPS position available from alerts — skip this transfer
      continue;
    }

    const { lat, lng } = mostRecentAlert;
    const hasAlerts = transfer.activeAlerts.length > 0;
    const color = hasAlerts ? '#e74c3c' : '#2980b9';

    seenIds.add(transfer.id);

    const existing = markerMap.get(transfer.id);
    if (existing !== undefined) {
      existing.setLatLng([lat, lng]);
      existing.setStyle({ color, fillColor: color });
      existing.setPopupContent(buildPopupHtml(transfer));
    } else {
      const marker = L.circleMarker([lat, lng], {
        radius: 10,
        color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: 2,
      });
      marker.bindPopup(buildPopupHtml(transfer));
      marker.addTo(map);
      markerMap.set(transfer.id, marker);
    }
  }

  // Remove markers for transfers no longer in the response
  for (const [id, marker] of markerMap) {
    if (!seenIds.has(id)) {
      marker.remove();
      markerMap.delete(id);
    }
  }
}

export function startTransferPolling(map: L.Map, token: string): () => void {
  const markerMap = new Map<string, L.CircleMarker>();
  let active = true;

  const poll = (): void => {
    if (!active) return;
    fetchTransfers(token)
      .then((transfers) => {
        if (active) renderTransfers(map, transfers, markerMap);
      })
      .catch((err: unknown) => {
        console.error('Error en polling de traslados:', err);
      });
  };

  poll(); // immediate first fetch
  const intervalId = setInterval(poll, POLL_INTERVAL_MS);

  return (): void => {
    active = false;
    clearInterval(intervalId);
    for (const marker of markerMap.values()) marker.remove();
    markerMap.clear();
  };
}
