/**
 * Payload para reserva empresa (CLIENT_EMPRESA).
 * productId debe pertenecer al cliente autenticado (pre-registrado vía CompanyProduct).
 * @param {string} productId
 * @returns {string} JSON string listo para http.post body
 */
export function makeEmpresaReservaPayload(productId) {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
  return JSON.stringify({
    origin: 'Aeropuerto Internacional de Carrasco',
    destination: 'Ciudad Vieja, Montevideo',
    originLat: -34.8167,
    originLng: -56.0167,
    destinationLat: -34.9014,
    destinationLng: -56.1645,
    scheduledDate: tomorrow,
    goods: [{ productId, quantity: 1 }],
  });
}

/**
 * Payload para ping GPS (tracking-service).
 * @param {string} deviceId  Identificador del conductor/dispositivo
 * @returns {string} JSON string listo para http.post body
 */
export function makeGpsPayload(deviceId) {
  const lat = -34.8 - Math.random() * 0.15;
  const lng = -56.1 - Math.random() * 0.15;
  return JSON.stringify({
    deviceId,
    lat,
    lng,
    speed: Math.floor(Math.random() * 80),
    timestamp: new Date().toISOString(),
  });
}
