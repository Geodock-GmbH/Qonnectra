import type { AfterNavigate } from '@sveltejs/kit';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fireAfterNavigate } from '$lib/test-utils/afterNavigateStub';

import { onProjectChange, routeProjectId } from './project';

const nav = vi.hoisted(() => ({
	callbacks: [] as Array<(navigation: AfterNavigate) => void>
}));

vi.mock('$app/navigation', () => ({
	afterNavigate: (callback: (navigation: AfterNavigate) => void) => nav.callbacks.push(callback)
}));

vi.mock('$app/state', () => ({ page: { params: { projectId: '5' } } }));

beforeEach(() => {
	nav.callbacks.length = 0;
});

describe('routeProjectId', () => {
	test('should read the project from the route params', () => {
		expect(routeProjectId()).toBe('5');
	});
});

describe('onProjectChange', () => {
	test('should run with the new id when the same page opens in another project', () => {
		const callback = vi.fn();
		onProjectChange(callback);

		fireAfterNavigate(nav.callbacks, { projectId: '5' }, { projectId: '7' });

		expect(callback).toHaveBeenCalledExactlyOnceWith('7');
	});

	test('should stay quiet when only another param changes', () => {
		const callback = vi.fn();
		onProjectChange(callback);

		fireAfterNavigate(
			nav.callbacks,
			{ projectId: '5', flagId: '1' },
			{ projectId: '5', flagId: '2' }
		);

		expect(callback).not.toHaveBeenCalled();
	});

	test('should treat the initial page load as no change', () => {
		const callback = vi.fn();
		onProjectChange(callback);

		fireAfterNavigate(nav.callbacks, null, { projectId: '5' });

		expect(callback).not.toHaveBeenCalled();
	});

	test('should stay quiet when the navigation leaves the project prefix', () => {
		const callback = vi.fn();
		onProjectChange(callback);

		fireAfterNavigate(nav.callbacks, { projectId: '5' }, {});

		expect(callback).not.toHaveBeenCalled();
	});
});
