import { get, writable } from 'svelte/store';

import { drawerWidth } from '$lib/stores/store';

function createDrawerStore() {
	let keyCounter = 0;

	const { subscribe, set, update } = writable({
		open: false,
		title: '',
		component: null,
		props: {},
		width: 400,
		key: 0
	});

	return {
		subscribe,
		open: ({ title = '', component = null, props = {}, width = null } = {}) => {
			const finalWidth = width ?? get(drawerWidth);
			keyCounter += 1;
			set({
				open: true,
				title,
				component,
				props,
				width: finalWidth,
				key: keyCounter
			});
		},
		close: () => {
			update((store) => ({
				...store,
				open: false
			}));
		},
		setTitle: (title) => {
			update((store) => ({
				...store,
				title
			}));
		},
		setComponent: (component, props = {}) => {
			keyCounter += 1;
			update((store) => ({
				...store,
				component,
				props,
				key: keyCounter
			}));
		},
		setWidth: (width) => {
			const clampedWidth = Math.max(200, width);
			drawerWidth.set(clampedWidth);
			update((store) => ({
				...store,
				width: clampedWidth
			}));
		}
	};
}

export const drawerStore = createDrawerStore();
