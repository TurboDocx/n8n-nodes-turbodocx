/**
 * Webhook signature verification helper (ported from @turbodocx/sdk).
 *
 * Verifies the `X-TurboDocx-Signature` header on an incoming webhook delivery:
 *   - Header:        `X-TurboDocx-Signature: sha256=<hex>`
 *   - Timestamp:     `X-TurboDocx-Timestamp: <unix-seconds>`
 *   - String signed: `${timestamp}.${rawBody}`
 *   - Algorithm:     HMAC-SHA256
 *
 * Enforces a configurable timestamp tolerance (default 300s) to prevent
 * replay attacks. Uses constant-time comparison.
 */

import { createHmac, timingSafeEqual } from 'crypto';

export interface VerifyWebhookSignatureOptions {
	/** Max acceptable age of the timestamp header, in seconds (default 300; 0 disables). */
	toleranceSeconds?: number;
	/** Override the current-time function (Unix seconds) for testing. */
	now?: () => number;
}

export function verifyWebhookSignature(
	rawBody: string | Buffer,
	signatureHeader: string,
	timestampHeader: string,
	secret: string,
	options: VerifyWebhookSignatureOptions = {},
): boolean {
	if (!signatureHeader || !timestampHeader || !secret) return false;

	const toleranceSeconds = options.toleranceSeconds ?? 300;
	if (toleranceSeconds > 0) {
		const now = options.now ? options.now() : Math.floor(Date.now() / 1000);
		const ts = Number.parseInt(timestampHeader, 10);
		if (!Number.isFinite(ts)) return false;
		if (Math.abs(now - ts) > toleranceSeconds) return false;
	}

	const bodyString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
	const expected =
		'sha256=' +
		createHmac('sha256', secret).update(`${timestampHeader}.${bodyString}`, 'utf8').digest('hex');

	const a = Buffer.from(expected, 'utf8');
	const b = Buffer.from(signatureHeader, 'utf8');
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}
