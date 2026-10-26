#!/usr/bin/env node
/**
 * Nx demo-request API.
 *
 * Receives the nx-web demo request form, validates every field independently of
 * the browser, stores it in SQLite and optionally emails the team. Contract and
 * field rules follow nx-web/docs/backend-integration.md; the frontend needs no
 * change because it already posts to /api/demo-requests.
 *
 * Uses Node built-ins only (node:sqlite needs --experimental-sqlite on Node 22).
 * The single runtime dependency is nodemailer, loaded lazily so that a missing
 * SMTP configuration does not stop records from being stored.
 */

import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.PORT || 8787);
const DB_PATH = process.env.DB_PATH || '/var/lib/nx-api/leads.db';
const MAX_BODY_BYTES = 64 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 5;
const NOTIFY_TO = process.env.NOTIFY_TO || 'hello@nx-growth.com';
const NOTIFY_FROM = process.env.NOTIFY_FROM || 'NX website <no-reply@nxgrowth.ai>';
const POLICY_VERSION = process.env.POLICY_VERSION || '2026-10-05';
const RETENTION_MONTHS = 24;

const REFERRAL_SOURCES = new Set(['search_engine', 'social_media', 'referral', 'event', 'other']);
const MAX_LENGTH = {
  firstName: 100,
  lastName: 100,
  title: 150,
  companyName: 200,
  companyWebsite: 500,
  phoneNumber: 40,
  email: 254,
};

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS demo_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL UNIQUE,
    idempotency_key TEXT UNIQUE,
    received_at TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    title TEXT NOT NULL,
    company_name TEXT NOT NULL,
    company_website TEXT NOT NULL,
    phone_number TEXT,
    email TEXT NOT NULL,
    referral_source TEXT NOT NULL,
    communication_consent INTEGER NOT NULL,
    privacy_policy_accepted INTEGER NOT NULL,
    source TEXT,
    client_ip TEXT,
    user_agent TEXT,
    notification_state TEXT NOT NULL DEFAULT 'pending',
    notified_at TEXT
  );
  CREATE INDEX IF NOT EXISTS demo_requests_received_at ON demo_requests (received_at);
  CREATE TABLE IF NOT EXISTS rate_limit (
    client_ip TEXT NOT NULL,
    window_start INTEGER NOT NULL,
    hit_count INTEGER NOT NULL,
    PRIMARY KEY (client_ip, window_start)
  );
`);

const insertRequest = db.prepare(`
  INSERT INTO demo_requests (
    request_id, idempotency_key, received_at, policy_version,
    first_name, last_name, title, company_name, company_website,
    phone_number, email, referral_source,
    communication_consent, privacy_policy_accepted, source, client_ip, user_agent
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const findByIdempotencyKey = db.prepare('SELECT request_id FROM demo_requests WHERE idempotency_key = ?');
const markNotification = db.prepare('UPDATE demo_requests SET notification_state = ?, notified_at = ? WHERE request_id = ?');
const readRateRow = db.prepare('SELECT hit_count FROM rate_limit WHERE client_ip = ? AND window_start = ?');
const insertRateRow = db.prepare('INSERT INTO rate_limit (client_ip, window_start, hit_count) VALUES (?, ?, 1)');
const bumpRateRow = db.prepare('UPDATE rate_limit SET hit_count = hit_count + 1 WHERE client_ip = ? AND window_start = ?');
const sweepRateRows = db.prepare('DELETE FROM rate_limit WHERE window_start < ?');

function log(event, detail) {
  process.stdout.write(`${new Date().toISOString()} ${event} ${JSON.stringify(detail)}\n`);
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  response.end(response.method === 'HEAD' ? undefined : payload);
}

function clientIp(request) {
  const forwarded = request.headers['x-real-ip'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.trim().slice(0, 64);
  return (request.socket.remoteAddress || '').slice(0, 64);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body_too_large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function checkText(payload, key, fieldErrors) {
  const raw = payload[key];
  if (!trimmed(raw)) {
    fieldErrors[key] = 'Required.';
    return '';
  }
  const max = MAX_LENGTH[key];
  if (raw.length > max) {
    fieldErrors[key] = `Must be ${max} characters or fewer.`;
    return '';
  }
  return trimmed(raw);
}

export function validate(payload) {
  const fieldErrors = {};
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { fieldErrors: { form: 'Expected a JSON object.' }, record: null };
  }

  const firstName = checkText(payload, 'firstName', fieldErrors);
  const lastName = checkText(payload, 'lastName', fieldErrors);
  const title = checkText(payload, 'title', fieldErrors);
  const companyName = checkText(payload, 'companyName', fieldErrors);

  let companyWebsite = '';
  const rawWebsite = trimmed(payload.companyWebsite);
  if (!rawWebsite) {
    fieldErrors.companyWebsite = 'Required.';
  } else if (rawWebsite.length > MAX_LENGTH.companyWebsite) {
    fieldErrors.companyWebsite = `Must be ${MAX_LENGTH.companyWebsite} characters or fewer.`;
  } else {
    let parsed = null;
    try {
      parsed = new URL(rawWebsite);
    } catch {
      parsed = null;
    }
    if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
      fieldErrors.companyWebsite = 'Enter a URL starting with http:// or https://.';
    } else {
      companyWebsite = parsed.toString();
    }
  }

  let phoneNumber = null;
  if (payload.phoneNumber !== null && payload.phoneNumber !== undefined && payload.phoneNumber !== '') {
    const rawPhone = trimmed(payload.phoneNumber);
    if (rawPhone.length > MAX_LENGTH.phoneNumber) {
      fieldErrors.phoneNumber = `Must be ${MAX_LENGTH.phoneNumber} characters or fewer.`;
    } else {
      phoneNumber = rawPhone;
    }
  }

  const rawEmail = payload.email;
  let email = '';
  if (!trimmed(rawEmail)) {
    fieldErrors.email = 'Required.';
  } else if (rawEmail.length > MAX_LENGTH.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed(rawEmail))) {
    fieldErrors.email = 'Enter a valid email address.';
  } else {
    email = trimmed(rawEmail);
  }

  const referralSource = trimmed(payload.referralSource);
  if (!referralSource) {
    fieldErrors.referralSource = 'Required.';
  } else if (!REFERRAL_SOURCES.has(referralSource)) {
    fieldErrors.referralSource = 'Unsupported value.';
  }

  if (payload.communicationConsent !== true) fieldErrors.communicationConsent = 'Required.';
  if (payload.privacyPolicyAccepted !== true) fieldErrors.privacyPolicyAccepted = 'Required.';

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, record: null };

  return {
    fieldErrors: {},
    record: {
      firstName,
      lastName,
      title,
      companyName,
      companyWebsite,
      phoneNumber,
      email,
      referralSource,
      communicationConsent: true,
      privacyPolicyAccepted: true,
      source: trimmed(payload.source) || 'nx-web',
    },
  };
}

function rateLimited(ip) {
  const window = Math.floor(Date.now() / RATE_WINDOW_MS) * RATE_WINDOW_MS;
  sweepRateRows.run(window - RATE_WINDOW_MS);
  const row = readRateRow.get(ip, window);
  if (!row) {
    insertRateRow.run(ip, window);
    return false;
  }
  if (row.hit_count >= RATE_MAX_REQUESTS) return true;
  bumpRateRow.run(ip, window);
  return false;
}

let transporter = null;
let mailState = 'pending';

async function setupMail() {
  if (!process.env.SMTP_HOST) {
    mailState = 'not_configured';
    log('mail', { state: mailState, reason: 'SMTP_HOST unset' });
    return;
  }
  try {
    const nodemailer = await import('nodemailer');
    const secure = process.env.SMTP_SECURE === 'true';
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure,
      // On 587 the session starts in clear text; never downgrade to plaintext
      // if the server fails to advertise STARTTLS.
      requireTLS: !secure,
      // Google's relay can reject the default EC2 internal hostname in EHLO.
      ...(process.env.SMTP_HELO_NAME ? { name: process.env.SMTP_HELO_NAME } : {}),
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
    await transporter.verify();
    mailState = 'ready';
  } catch (error) {
    transporter = null;
    mailState = 'failed';
    log('mail', { state: mailState, detail: String(error && error.message ? error.message : error) });
    return;
  }
  log('mail', { state: mailState });
}

async function notify(requestId, record, receivedAt) {
  if (!transporter) {
    markNotification.run(mailState === 'ready' ? 'sent' : mailState, null, requestId);
    return;
  }
  try {
    await transporter.sendMail({
      from: NOTIFY_FROM,
      to: NOTIFY_TO,
      replyTo: `${record.firstName} ${record.lastName} <${record.email}>`,
      subject: `New demo request: ${record.companyName}`,
      text: [
        'A new demo request arrived on nxgrowth.ai.',
        '',
        `Request id: ${requestId}`,
        `Received at: ${receivedAt}`,
        '',
        `Name: ${record.firstName} ${record.lastName}`,
        `Title: ${record.title}`,
        `Company: ${record.companyName}`,
        `Website: ${record.companyWebsite}`,
        `Email: ${record.email}`,
        `Phone: ${record.phoneNumber || 'not provided'}`,
        `Referral source: ${record.referralSource}`,
        `Communication consent: ${record.communicationConsent}`,
        `Privacy policy accepted: ${record.privacyPolicyAccepted}`,
        `Policy version: ${POLICY_VERSION}`,
      ].join('\n'),
    });
    markNotification.run('sent', new Date().toISOString(), requestId);
    log('notify', { requestId, state: 'sent' });
  } catch (error) {
    markNotification.run('failed', null, requestId);
    log('notify', { requestId, state: 'failed', detail: String(error && error.message ? error.message : error) });
  }
}

async function handleSubmission(request, response) {
  const ip = clientIp(request);
  let raw;
  try {
    raw = await readBody(request);
  } catch {
    sendJson(response, 413, { success: false, code: 'body_too_large' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    sendJson(response, 400, { success: false, code: 'invalid_json' });
    return;
  }

  const keyHeader = request.headers['idempotency-key'];
  const idempotencyKey = trimmed(typeof keyHeader === 'string' ? keyHeader : '').slice(0, 128) || null;
  if (idempotencyKey) {
    const previous = findByIdempotencyKey.get(idempotencyKey);
    if (previous) {
      log('duplicate', { requestId: previous.request_id });
      sendJson(response, 200, { success: true, requestId: previous.request_id, duplicate: true });
      return;
    }
  }

  if (rateLimited(ip)) {
    log('rate_limited', { ip });
    sendJson(response, 429, { success: false, code: 'too_many_requests' });
    return;
  }

  const { fieldErrors, record } = validate(payload);
  if (!record) {
    sendJson(response, 422, { success: false, code: 'validation_failed', fieldErrors });
    return;
  }

  const requestId = `demo_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const receivedAt = new Date().toISOString();
  insertRequest.run(
    requestId,
    idempotencyKey,
    receivedAt,
    POLICY_VERSION,
    record.firstName,
    record.lastName,
    record.title,
    record.companyName,
    record.companyWebsite,
    record.phoneNumber,
    record.email,
    record.referralSource,
    record.communicationConsent ? 1 : 0,
    record.privacyPolicyAccepted ? 1 : 0,
    record.source,
    ip,
    trimmed(request.headers['user-agent']).slice(0, 400) || null,
  );
  log('stored', { requestId, source: record.source });
  sendJson(response, 201, { success: true, requestId });
  void notify(requestId, record, receivedAt);
}

function pruneExpired() {
  const cutoff = new Date(Date.now() - RETENTION_MONTHS * 30 * 24 * 60 * 60 * 1000).toISOString();
  const result = db.prepare('DELETE FROM demo_requests WHERE received_at < ?').run(cutoff);
  log('prune', { months: RETENTION_MONTHS, cutoff, removed: Number(result.changes) });
}

async function start() {
  await mkdir(path.dirname(DB_PATH), { recursive: true });
  await setupMail();

  const server = http.createServer((request, response) => {
    const route = new URL(request.url, 'http://127.0.0.1').pathname;
    if (route === '/api/demo-requests') {
      if (request.method !== 'POST') {
        sendJson(response, 405, { success: false, code: 'method_not_allowed' });
        return;
      }
      handleSubmission(request, response).catch((error) => {
        log('error', { detail: String(error && error.message ? error.message : error) });
        if (!response.headersSent) sendJson(response, 500, { success: false, code: 'internal_error' });
      });
      return;
    }
    if (route === '/healthz') {
      sendJson(response, 200, { ok: true, mail: mailState });
      return;
    }
    sendJson(response, 404, { success: false, code: 'not_found' });
  });

  server.listen(PORT, '127.0.0.1', () => log('listening', { port: PORT, db: DB_PATH, mail: mailState }));
}

// Guard so importing this module from tests does not boot the HTTP server.
const invokedDirectly = Boolean(process.argv[1]) && pathToFileURL(process.argv[1] ?? '').href === import.meta.url;

if (invokedDirectly) {
  if (process.argv.includes('--prune')) {
    pruneExpired();
  } else {
    start().catch((error) => {
      log('fatal', { detail: String(error && error.stack ? error.stack : error) });
      process.exit(1);
    });
  }
}
