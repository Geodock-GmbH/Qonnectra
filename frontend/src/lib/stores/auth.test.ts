import { get } from 'svelte/store';
import { describe, expect, test } from 'vitest';

import { updateUserStore, userStore } from './auth';

describe('userStore', () => {
	test('should default to a non-authenticated state', () => {
		expect(get(userStore)).toEqual({ isAuthenticated: false });
	});
});

describe('updateUserStore', () => {
	test('should store the given user data', () => {
		const userData = { isAuthenticated: true, username: 'malte', is_staff: true };

		updateUserStore(userData);

		expect(get(userStore)).toEqual(userData);
	});

	test('should reset to non-authenticated for null data', () => {
		updateUserStore({ isAuthenticated: true, username: 'malte' });
		updateUserStore(null);

		expect(get(userStore)).toEqual({ isAuthenticated: false });
	});

	test('should reset to non-authenticated for undefined data', () => {
		updateUserStore({ isAuthenticated: true });
		updateUserStore(undefined);

		expect(get(userStore)).toEqual({ isAuthenticated: false });
	});
});
