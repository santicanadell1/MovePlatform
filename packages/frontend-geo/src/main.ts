import { onAuthChange, signIn } from './auth';
import { initMap } from './map';
import { fetchAndRenderZones, addDrawControl } from './zones';
import { startTransferPolling } from './transfers';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

const overlay = document.getElementById('login-overlay') as HTMLDivElement;
const emailInput = document.getElementById('login-email') as HTMLInputElement;
const passwordInput = document.getElementById('login-password') as HTMLInputElement;
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const loginError = document.getElementById('login-error') as HTMLDivElement;

function showLogin(): void {
  overlay.classList.add('visible');
}

function hideLogin(): void {
  overlay.classList.remove('visible');
}

loginBtn.addEventListener('click', async () => {
  loginError.textContent = '';
  loginBtn.disabled = true;
  try {
    await signIn(emailInput.value.trim(), passwordInput.value);
  } catch {
    loginError.textContent = 'Credenciales inválidas. Verificá tu email y contraseña.';
  } finally {
    loginBtn.disabled = false;
  }
});

passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

let mapInitialized = false;
let stopTransferPolling: (() => void) | null = null;

onAuthChange(async (user) => {
  if (!user) {
    if (stopTransferPolling !== null) {
      stopTransferPolling();
      stopTransferPolling = null;
    }
    showLogin();
    return;
  }

  hideLogin();

  if (mapInitialized) return;
  mapInitialized = true;

  const token = await user.getIdToken();
  const { map, drawnLayers } = initMap();
  try {
    await fetchAndRenderZones(map, drawnLayers, token);
  } catch {
    console.error('No se pudieron cargar las zonas existentes.');
  }
  addDrawControl(map, drawnLayers, token);
  stopTransferPolling = startTransferPolling(map, token);
});
