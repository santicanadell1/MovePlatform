import L from 'leaflet';
import 'leaflet-draw';
import type { ZoneOutput, ZoneType, ZonesApiResponse } from './types';

const API_URL = import.meta.env.VITE_API_URL as string;

const ZONE_STYLES: Record<ZoneType, L.PathOptions> = {
  RED: { color: '#e74c3c', fillOpacity: 0.4, weight: 2 },
  PREFERRED: { color: '#2ecc71', fillOpacity: 0.4, weight: 2 },
};

const ZONE_LABELS: Record<ZoneType, string> = {
  RED: 'Prohibida',
  PREFERRED: 'Preferida',
};

function openZoneDialog(opts: {
  title: string;
  initialName: string;
  initialType: ZoneType;
  onConfirm: (name: string, type: ZoneType) => Promise<void>;
}): void {
  const dialog = document.getElementById('zone-dialog') as HTMLDialogElement;
  const titleEl = document.getElementById('zone-dialog-title') as HTMLElement;
  const nameInput = document.getElementById('zone-name') as HTMLInputElement;
  const typeSelect = document.getElementById('zone-type') as HTMLSelectElement;
  const confirmBtn = document.getElementById('zone-confirm') as HTMLButtonElement;
  const cancelBtn = document.getElementById('zone-cancel') as HTMLButtonElement;

  titleEl.textContent = opts.title;
  nameInput.value = opts.initialName;
  typeSelect.value = opts.initialType;
  dialog.showModal();

  const onConfirm = async (): Promise<void> => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    confirmBtn.disabled = true;
    try {
      await opts.onConfirm(name, typeSelect.value as ZoneType);
      dialog.close();
    } finally {
      confirmBtn.disabled = false;
      cleanup();
    }
  };

  const onCancel = (): void => { dialog.close(); cleanup(); };

  const cleanup = (): void => {
    confirmBtn.removeEventListener('click', onConfirm);
    cancelBtn.removeEventListener('click', onCancel);
  };

  confirmBtn.addEventListener('click', onConfirm);
  cancelBtn.addEventListener('click', onCancel);
}

function buildPopup(zone: ZoneOutput): string {
  return `
    <strong>${zone.name}</strong><br/>
    ${ZONE_LABELS[zone.type]}<br/>
    <div style="margin-top:6px;display:flex;gap:6px">
      <button data-action="edit" data-id="${zone.id}"
        style="padding:2px 8px;font-size:0.8rem;cursor:pointer">Editar</button>
      <button data-action="delete" data-id="${zone.id}"
        style="padding:2px 8px;font-size:0.8rem;cursor:pointer;color:#e74c3c">Borrar</button>
    </div>`;
}

function renderZone(
  zone: ZoneOutput,
  map: L.Map,
  drawnLayers: L.FeatureGroup,
  token: string,
): void {
  const layer = L.geoJSON(zone.geom, { style: ZONE_STYLES[zone.type] });

  layer.bindPopup(buildPopup(zone));

  layer.on('popupopen', () => {
    const popup = layer.getPopup()?.getElement();
    if (!popup) return;

    popup.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
      if (!confirm(`¿Borrar "${zone.name}"?`)) return;
      const res = await fetch(`${API_URL}/api/zonas/${zone.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok || res.status === 404) {
        layer.closePopup();
        drawnLayers.removeLayer(layer);
        map.removeLayer(layer);
      } else {
        alert(`Error al borrar: ${res.status}`);
      }
    });

    popup.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
      layer.closePopup();
      openZoneDialog({
        title: 'Editar zona',
        initialName: zone.name,
        initialType: zone.type,
        onConfirm: async (name, type) => {
          const res = await fetch(`${API_URL}/api/zonas/${zone.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name, type }),
          });
          if (!res.ok) { alert(`Error al editar: ${res.status}`); return; }
          const updated = (await res.json() as { data: ZoneOutput }).data;
          layer.setStyle(ZONE_STYLES[updated.type]);
          layer.setPopupContent(buildPopup(updated));
          Object.assign(zone, updated);
        },
      });
    });
  });

  layer.addTo(map);
  drawnLayers.addLayer(layer);
}

export async function fetchAndRenderZones(
  map: L.Map,
  drawnLayers: L.FeatureGroup,
  token: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/zonas`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.error('Error al cargar zonas:', res.status);
    return;
  }

  const body: ZonesApiResponse = await res.json() as ZonesApiResponse;
  body.data.forEach((zone) => renderZone(zone, map, drawnLayers, token));
}

export function addDrawControl(
  map: L.Map,
  drawnLayers: L.FeatureGroup,
  token: string,
): void {
  const drawControl = new L.Control.Draw({
    draw: {
      polygon: { shapeOptions: { color: '#3498db' }, showArea: false },
      rectangle: { shapeOptions: { color: '#3498db' }, showArea: false },
      circle: false,
      marker: false,
      circlemarker: false,
      polyline: false,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    edit: false as any,
  });
  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, (event) => {
    const tmpLayer = event.layer as L.Polygon;
    const geom = tmpLayer.toGeoJSON().geometry;

    openZoneDialog({
      title: 'Nueva zona',
      initialName: '',
      initialType: 'PREFERRED',
      onConfirm: async (name, type) => {
        const res = await fetch(`${API_URL}/api/zonas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name, type, geom }),
        });

        if (res.status === 403) { alert('Sin permisos de administrador para crear zonas.'); return; }
        if (!res.ok) { alert(`Error al crear zona: ${res.status}`); return; }

        const body = await res.json() as { data: ZoneOutput };
        renderZone(body.data, map, drawnLayers, token);
      },
    });
  });
}
