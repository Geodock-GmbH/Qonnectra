import { error } from '@sveltejs/kit';
import { describe, expect, test } from 'vitest';

import { remoteErrorMessage, remoteErrorStatus } from './remote-error';

describe('remoteErrorMessage', () => {
	test('should read the body message of a Kit HttpError', () => {
		let thrown: unknown;
		try {
			error(400, 'street: required');
		} catch (e) {
			thrown = e;
		}
		expect(remoteErrorMessage(thrown)).toBe('street: required');
	});

	test('should read a plain Error message', () => {
		expect(remoteErrorMessage(new Error('boom'))).toBe('boom');
	});

	test('should return null for values without a message', () => {
		expect(remoteErrorMessage('nope')).toBeNull();
		expect(remoteErrorMessage(undefined)).toBeNull();
		expect(remoteErrorMessage(new Error(''))).toBeNull();
	});
});

describe('remoteErrorStatus', () => {
	test('should return the status of a Kit HttpError', () => {
		let thrown: unknown;
		try {
			error(409, 'duplicate');
		} catch (e) {
			thrown = e;
		}
		expect(remoteErrorStatus(thrown)).toBe(409);
	});

	test('should return null for other errors', () => {
		expect(remoteErrorStatus(new Error('x'))).toBeNull();
		expect(remoteErrorStatus('x')).toBeNull();
	});
});
