import { config } from './config.js';

export class DemoRequestError extends Error {
  constructor(code, status = 0, fieldErrors = {}) {
    super(code);
    this.name = 'DemoRequestError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Send a real request. Never simulate successful submission in production. */
export async function submitDemoRequest(payload, requestId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const response = await fetch(config.demoEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Idempotency-Key': requestId },
      credentials: config.credentials,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') || '';
    let body = null;
    if (contentType.includes('application/json')) {
      try { body = await response.json(); } catch { throw new DemoRequestError('invalid_response', response.status); }
    }
    if (!response.ok) {
      if (response.status === 501 && body?.code === 'backend_not_connected') throw new DemoRequestError('backend_not_connected', response.status);
      throw new DemoRequestError('http_error', response.status, body?.fieldErrors || {});
    }
    // Reject static-host fallback HTML and ambiguous response bodies.
    if (!body || body.success !== true) throw new DemoRequestError('invalid_response', response.status);
    return body;
  } catch (error) {
    if (error instanceof DemoRequestError) throw error;
    if (controller.signal.aborted) throw new DemoRequestError('timeout');
    throw new DemoRequestError('network_error');
  } finally {
    clearTimeout(timeout);
  }
}
