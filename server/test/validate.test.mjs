import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const workspace = mkdtempSync(path.join(tmpdir(), 'nx-api-test-'));
process.env.DB_PATH = path.join(workspace, 'leads.db');
const { validate } = await import('../index.mjs');

const valid = {
  firstName: 'Alex',
  lastName: 'Chen',
  title: 'Growth Lead',
  companyName: 'Example Inc.',
  companyWebsite: 'https://example.com/',
  phoneNumber: null,
  email: 'alex@example.com',
  referralSource: 'referral',
  communicationConsent: true,
  privacyPolicyAccepted: true,
  source: 'nx-web',
};

test('accepts a complete submission', () => {
  const { fieldErrors, record } = validate({ ...valid });
  assert.deepEqual(fieldErrors, {});
  assert.equal(record.firstName, 'Alex');
  assert.equal(record.companyWebsite, 'https://example.com/');
  assert.equal(record.phoneNumber, null);
  assert.equal(record.source, 'nx-web');
});

test('normalises whitespace and optional phone', () => {
  const { fieldErrors, record } = validate({ ...valid, firstName: '  Alex  ', phoneNumber: ' +1 (555) 0100 ' });
  assert.deepEqual(fieldErrors, {});
  assert.equal(record.firstName, 'Alex');
  assert.equal(record.phoneNumber, '+1 (555) 0100');
});

test('reports every missing required field', () => {
  const { fieldErrors, record } = validate({});
  assert.equal(record, null);
  for (const key of ['firstName', 'lastName', 'title', 'companyName', 'companyWebsite', 'email', 'referralSource', 'communicationConsent', 'privacyPolicyAccepted']) {
    assert.ok(fieldErrors[key], `missing error for ${key}`);
  }
});

test('rejects malformed email and website', () => {
  const email = validate({ ...valid, email: 'alex@example' }).fieldErrors;
  assert.ok(email.email);
  const website = validate({ ...valid, companyWebsite: 'ftp://example.com/' }).fieldErrors;
  assert.ok(website.companyWebsite);
  const javascriptUrl = validate({ ...valid, companyWebsite: 'javascript:alert(1)' }).fieldErrors;
  assert.ok(javascriptUrl.companyWebsite);
});

test('rejects unknown referral source', () => {
  const { fieldErrors } = validate({ ...valid, referralSource: 'telepathy' });
  assert.ok(fieldErrors.referralSource);
});

test('requires both consent flags to be true', () => {
  const consent = validate({ ...valid, communicationConsent: false }).fieldErrors;
  assert.ok(consent.communicationConsent);
  const policy = validate({ ...valid, privacyPolicyAccepted: 'yes' }).fieldErrors;
  assert.ok(policy.privacyPolicyAccepted);
});

test('rejects oversized fields instead of truncating them', () => {
  const long = 'x'.repeat(101);
  const { fieldErrors } = validate({ ...valid, firstName: long, email: `${'a'.repeat(250)}@example.com` });
  assert.ok(fieldErrors.firstName);
  assert.ok(fieldErrors.email);
});

test('rejects payloads that are not objects', () => {
  assert.ok(validate(null).fieldErrors.form);
  assert.ok(validate([]).fieldErrors.form);
  assert.ok(validate('nope').fieldErrors.form);
});
