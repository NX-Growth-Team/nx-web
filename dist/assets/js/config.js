// Public frontend settings. Never put secrets or backend API keys in this file.
export const config = Object.freeze({
  demoEndpoint: '/api/demo-requests',
  requestTimeoutMs: 15000,
  // Change to 'include' only when the backend explicitly requires cross-origin cookies.
  credentials: 'same-origin',
});
