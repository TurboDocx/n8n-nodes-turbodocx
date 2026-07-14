import * as crypto from 'crypto';
import { verifyWebhookSignature } from '../../TurboDocx/shared/verifyWebhookSignature';

/** Reproduces RapidDocxBackend WebhookService.generateSignature EXACTLY. */
function backendSign(payload: string, secret: string, timestamp: string): string {
  const stringToSign = `${timestamp}.${payload}`;
  return 'sha256=' + crypto.createHmac('sha256', secret).update(stringToSign, 'utf8').digest('hex');
}

describe('trigger HMAC vs backend WebhookService', () => {
  const secret = 'whsec_test_1234567890';

  it('accepts a signature produced by the backend signer over the exact wire bytes', () => {
    // Backend does: const jsonPayload = JSON.stringify(payload); ... post(url, jsonPayload)
    const payload = { event: 'signature.document.completed', event_id: 'evt_x', version: '1.0', data: { id: 'doc-1' } };
    const jsonPayload = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = backendSign(jsonPayload, secret, timestamp);

    // n8n hands us the raw bytes off the wire.
    const rawBody = Buffer.from(jsonPayload, 'utf8');
    expect(verifyWebhookSignature(rawBody, signature, timestamp, secret)).toBe(true);
  });

  it('REJECTS a re-serialized body — proves rawBody:true is load-bearing', () => {
    const payload = { event: 'signature.document.completed', data: { id: 'doc-1' } };
    const jsonPayload = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = backendSign(jsonPayload, secret, timestamp);

    // What we'd get if we re-stringified n8n's PARSED body with different spacing.
    const reSerialized = JSON.stringify(JSON.parse(jsonPayload), null, 2);
    expect(verifyWebhookSignature(reSerialized, signature, timestamp, secret)).toBe(false);
  });

  it('rejects a stale timestamp beyond the 300s tolerance (backend TIMESTAMP_TOLERANCE)', () => {
    const jsonPayload = JSON.stringify({ event: 'signature.document.voided' });
    const stale = (Math.floor(Date.now() / 1000) - 301).toString();
    const signature = backendSign(jsonPayload, secret, stale);
    expect(verifyWebhookSignature(jsonPayload, signature, stale, secret)).toBe(false);
    // ...but accepts it inside the window.
    const fresh = (Math.floor(Date.now() / 1000) - 299).toString();
    expect(verifyWebhookSignature(jsonPayload, backendSign(jsonPayload, secret, fresh), fresh, secret)).toBe(true);
  });

  it('rejects a wrong secret and a tampered body', () => {
    const jsonPayload = JSON.stringify({ event: 'signature.document.completed' });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = backendSign(jsonPayload, secret, timestamp);
    expect(verifyWebhookSignature(jsonPayload, signature, timestamp, 'wrong-secret')).toBe(false);
    expect(verifyWebhookSignature(jsonPayload + ' ', signature, timestamp, secret)).toBe(false);
  });
});
