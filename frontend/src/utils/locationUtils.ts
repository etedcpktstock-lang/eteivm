/**
 * Fetches the current GPS coordinates of the user.
 * Returns formatted string "lat, lng" or undefined if failed.
 */
export async function getCoordinates(): Promise<{ lat: number; lng: number } | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(undefined);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(undefined),
      { timeout: 8000, enableHighAccuracy: true }
    );
  });
}

/**
 * Helper to get coordinates as a formatted string for display or watermarking.
 */
export async function getCoordinatesString(): Promise<string | undefined> {
  const coords = await getCoordinates();
  if (!coords) return undefined;
  return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
}
