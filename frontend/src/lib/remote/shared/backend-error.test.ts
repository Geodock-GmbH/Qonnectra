import { describe, expect, test } from 'vitest';

import { backendErrorMessage, failFromResponse } from './backend-error';

describe('backendErrorMessage', () => {
	test('should prefer the detail string', () => {
		expect(backendErrorMessage({ detail: 'Not found', street: ['bad'] }, 'fallback')).toBe(
			'Not found'
		);
	});

	test('should join DRF field errors', () => {
		expect(
			backendErrorMessage({ street: ['This field is required.'], zip_code: 'invalid' }, 'fallback')
		).toBe('street: This field is required.; zip_code: invalid');
	});

	test('should fall back for empty or non-object bodies', () => {
		expect(backendErrorMessage({}, 'fallback')).toBe('fallback');
		expect(backendErrorMessage(null, 'fallback')).toBe('fallback');
		expect(backendErrorMessage('text', 'fallback')).toBe('fallback');
	});
});

describe('failFromResponse', () => {
	test('should throw an HttpError carrying the backend status and detail', async () => {
		const response = new Response(JSON.stringify({ detail: 'Forbidden' }), { status: 403 });

		await expect(failFromResponse(response, 'fallback')).rejects.toMatchObject({
			status: 403,
			body: { message: 'Forbidden' }
		});
	});

	test('should use the fallback when the body is not JSON', async () => {
		const response = new Response('<html>', { status: 502 });

		await expect(failFromResponse(response, 'Failed to save')).rejects.toMatchObject({
			status: 502,
			body: { message: 'Failed to save' }
		});
	});

	test('should clamp statuses outside the error range to 500', async () => {
		const response = new Response(JSON.stringify({}), { status: 302 });

		await expect(failFromResponse(response, 'fallback')).rejects.toMatchObject({ status: 500 });
	});
});
