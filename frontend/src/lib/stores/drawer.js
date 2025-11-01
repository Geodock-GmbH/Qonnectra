import { get, writable } from 'svelte/store';

import { drawerWidth } from '$lib/stores/store';

function createDrawerStore() {
	const { subscribe, set, update } = writable({
		open: false,
		title: '',
		component: null,
		props: {},
		width: 400
	});

	return {
		subscribe,
		open: ({ title = '', component = null, props = {}, width = null } = {}) => {
			const finalWidth = width ?? get(drawerWidth);
			set({
				open: true,
				title,
				component,
				props,
				width: finalWidth
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
			update((store) => ({
				...store,
				component,
				props
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
