import { describe, expect, test } from 'vitest';

import { discardBodies, readOkJson } from './json';

describe('discardBodies', () => {
	test('should cancel every unread body', async () => {
		const responses = [new Response('first'), new Response('second')];

		await discardBodies(responses);

		expect(responses.map((response) => response.bodyUsed)).toEqual([true, true]);
	});

	test('should skip responses without a body', async () => {
		await expect(discardBodies([new Response(null, { status: 204 })])).resolves.toBeUndefined();
	});
});

describe('readOkJson', () => {
	test('should parse a successful body', async () => {
		await expect(readOkJson(Response.json({ id: 1 }))).resolves.toEqual({ id: 1 });
	});

	test('should discard a failed body and return undefined', async () => {
		const response = new Response('{"detail":"boom"}', { status: 500 });

		await expect(readOkJson(response)).resolves.toBeUndefined();
		expect(response.bodyUsed).toBe(true);
	});
});
