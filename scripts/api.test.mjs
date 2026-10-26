import test from 'node:test';
import assert from 'node:assert/strict';
import { submitDemoRequest, DemoRequestError } from '../dist/assets/js/api.js';
import { normalizeWebsite, validateDemoForm } from '../dist/assets/js/validation.js';

const valid = { firstName:'Alex',lastName:'Chen',title:'Growth Lead',companyName:'Example Inc.',companyWebsite:'example.com',email:'alex@example.com',phoneNumber:'',referralSource:'referral',communicationConsent:true };

test('optional phone, required consent, controlled referrals and normalized website', () => {
  assert.deepEqual(validateDemoForm(valid), {});
  assert.deepEqual(validateDemoForm({...valid,phoneNumber:'+81 (0)3-1234-5678 ext. 9'}), {});
  assert.equal(normalizeWebsite(' example.com '), 'https://example.com/');
  assert.equal(normalizeWebsite('javascript:alert(1)'), null);
  assert.equal(normalizeWebsite('https://user:password@example.com'), null);
  assert.ok(validateDemoForm({...valid,communicationConsent:false}).communicationConsent);
  assert.ok(validateDemoForm({...valid,referralSource:'unrecognized'}).referralSource);
  assert.ok(validateDemoForm({...valid,email:'invalid'}).email);
});

test('request sends JSON and the idempotency key; only explicit JSON success passes', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let seen;
  globalThis.fetch = async (url, options) => { seen={url,...options};return new Response(JSON.stringify({success:true,requestId:'demo_123'}),{status:201,headers:{'Content-Type':'application/json'}}); };
  const result = await submitDemoRequest(valid,'request-id');
  assert.equal(result.requestId,'demo_123');
  assert.equal(seen.url,'/api/demo-requests');
  assert.equal(seen.method,'POST');
  assert.equal(seen.headers['Idempotency-Key'],'request-id');
  assert.equal(seen.credentials,'same-origin');
  assert.deepEqual(JSON.parse(seen.body),valid);
  for (const response of [new Response('<html>fallback</html>',{headers:{'Content-Type':'text/html'}}),new Response(null,{status:204}),new Response('{"success":false}',{headers:{'Content-Type':'application/json'}})]) {
    globalThis.fetch = async () => response;
    await assert.rejects(submitDemoRequest(valid,'request-id'), error => error instanceof DemoRequestError && error.code==='invalid_response');
  }
});

test('backend field errors, rate limits, and network failure remain failures', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({success:false,fieldErrors:{email:'invalid'}}),{status:422,headers:{'Content-Type':'application/json'}});
  await assert.rejects(submitDemoRequest(valid,'request-id'),error=>error.status===422 && error.fieldErrors.email==='invalid');
  globalThis.fetch = async () => new Response('',{status:429});
  await assert.rejects(submitDemoRequest(valid,'request-id'),error=>error.status===429);
  globalThis.fetch = async () => {throw new TypeError('Network failed');};
  await assert.rejects(submitDemoRequest(valid,'request-id'),error=>error.code==='network_error');
  globalThis.fetch = async () => new Response(JSON.stringify({success:false,code:'backend_not_connected'}),{status:501,headers:{'Content-Type':'application/json'}});
  await assert.rejects(submitDemoRequest(valid,'request-id'),error=>error.code==='backend_not_connected');
});
