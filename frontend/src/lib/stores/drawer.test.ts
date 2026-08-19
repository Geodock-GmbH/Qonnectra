// @vitest-environment jsdom
import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { drawerWidth } from '$lib/stores/store';

import { drawerStore } from './drawer';

vi.mock('$app/environment', () => ({
	browser: true
}));

beforeEach(() => {
	drawerWidth.set(400);
	drawerStore.open({});
	drawerStore.close();
});

describe('drawerStore', () => {
	test('should open with defaults and the persisted drawer width', () => {
		drawerStore.open();

		expect(get(drawerStore)).toEqual({
			open: true,
			title: '',
			component: null,
			props: {},
			width: 400
		});
	});

	test('should open with the given content and explicit width', () => {
		const component = { name: 'FakeComponent' };

		drawerStore.open({ title: 'Details', component, props: { id: 7 }, width: 550 });

		expect(get(drawerStore)).toEqual({
			open: true,
			title: 'Details',
			component,
			props: { id: 7 },
			width: 550
		});
	});

	test('should keep content when closing', () => {
		drawerStore.open({ title: 'Details' });
		drawerStore.close();

		const state = get(drawerStore);
		expect(state.open).toBe(false);
		expect(state.title).toBe('Details');
	});

	test('should update the title', () => {
		drawerStore.open({ title: 'Old' });
		drawerStore.setTitle('New');

		expect(get(drawerStore).title).toBe('New');
	});

	test('should swap the component and its props', () => {
		const component = { name: 'Swapped' };

		drawerStore.setComponent(component, { a: 1 });

		const state = get(drawerStore);
		expect(state.component).toBe(component);
		expect(state.props).toEqual({ a: 1 });
	});

	test('should merge new props into existing ones', () => {
		drawerStore.open({ props: { a: 1, b: 2 } });
		drawerStore.updateProps({ b: 3, c: 4 });

		expect(get(drawerStore).props).toEqual({ a: 1, b: 3, c: 4 });
	});

	describe('setWidth', () => {
		test('should apply the width and persist it', () => {
			drawerStore.setWidth(500);

			expect(get(drawerStore).width).toBe(500);
			expect(get(drawerWidth)).toBe(500);
		});

		test('should clamp to the 200px minimum', () => {
			drawerStore.setWidth(50);

			expect(get(drawerStore).width).toBe(200);
		});

		test('should clamp to 80% of the viewport width', () => {
			const maxWidth = Math.floor(window.innerWidth * 0.8);

			drawerStore.setWidth(window.innerWidth * 2);

			expect(get(drawerStore).width).toBe(maxWidth);
		});
	});
});
