import { error } from '@sveltejs/kit';
import { describe, expect, test } from 'vitest';

import { remoteErrorMessage } from './remote-error';

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
