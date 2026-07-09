import L from 'leaflet';

const MONTEVIDEO: [number, number] = [-34.9011, -56.1645];

const LEGEND_HTML = `
  <div style="background:#fff;padding:8px 12px;border-radius:6px;box-shadow:0 1px 6px rgba(0,0,0,0.2);font-size:13px;line-height:1.8">
    <strong style="display:block;margin-bottom:4px">Zonas</strong>
    <span style="display:inline-block;width:14px;height:14px;background:#e74c3c;opacity:0.7;border-radius:2px;vertical-align:middle;margin-right:6px"></span>Prohibida<br/>
    <span style="display:inline-block;width:14px;height:14px;background:#2ecc71;opacity:0.7;border-radius:2px;vertical-align:middle;margin-right:6px"></span>Preferida<br/>
    <strong style="display:block;margin-top:6px;margin-bottom:4px">Traslados</strong>
    <span style="display:inline-block;width:14px;height:14px;background:#e74c3c;border-radius:50%;vertical-align:middle;margin-right:6px"></span>Con alertas<br/>
    <span style="display:inline-block;width:14px;height:14px;background:#2980b9;border-radius:50%;vertical-align:middle;margin-right:6px"></span>Sin alertas
  </div>
`;

export interface MapResult {
  map: L.Map;
  drawnLayers: L.FeatureGroup;
}

export function initMap(): MapResult {
  const map = L.map('map').setView(MONTEVIDEO, 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  const legend = new L.Control({ position: 'bottomright' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div');
    div.innerHTML = LEGEND_HTML;
    return div;
  };
  legend.addTo(map);

  const drawnLayers = new L.FeatureGroup().addTo(map);

  return { map, drawnLayers };
}
