import { connectLive } from './live-data.js';

// This small entry point can fetch data while the main UI module graph loads.
let initialConnection;
if (globalThis.location?.pathname.startsWith('/app/')) {
  initialConnection = connectLive();
  // The UI consumes the original rejection once it is ready to show an error.
  initialConnection.catch(() => {});
}

export function takeStartupConnection() {
  const connection = initialConnection;
  initialConnection = undefined;
  return connection ?? connectLive();
}
