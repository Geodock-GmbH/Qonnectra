import { get, writable } from 'svelte/store';

import { drawerWidth } from '$lib/stores/store';

/**
 * Creates a Svelte store for managing drawer state
 * Provides methods to control drawer visibility, content, and dimensions
 * @returns {Object} Drawer store with subscribe and control methods
 */
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
		/**
		 * Opens the drawer with specified configuration
		 * @param {Object} options - Drawer configuration options
		 * @param {string} [options.title=''] - Drawer title text
		 * @param {Component} [options.component=null] - Svelte component to render in drawer
		 * @param {Object} [options.props={}] - Props to pass to the component
		 * @param {number|null} [options.width=null] - Drawer width in pixels (uses persisted width if null)
		 */
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
		/**
		 * Closes the drawer without clearing its content
		 */
		close: () => {
			update((store) => ({
				...store,
				open: false
			}));
		},
		/**
		 * Updates the drawer title
		 * @param {string} title - New title text
		 */
		setTitle: (title) => {
			update((store) => ({
				...store,
				title
			}));
		},
		/**
		 * Updates the drawer component and its props
		 * @param {Component} component - Svelte component to render
		 * @param {Object} [props={}] - Props to pass to the component
		 */
		setComponent: (component, props = {}) => {
			update((store) => ({
				...store,
				component,
				props
			}));
		},
		/**
		 * Sets the drawer width with automatic clamping
		 * Ensures width stays between 200px (minimum) and 80% of viewport width (maximum)
		 * Persists the clamped width to localStorage
		 * @param {number} width - Desired width in pixels
		 */
		setWidth: (width) => {
			const maxWidth = Math.floor(window.innerWidth * 0.8);
			const clampedWidth = Math.max(200, Math.min(width, maxWidth));
			drawerWidth.set(clampedWidth);
			update((store) => ({
				...store,
				width: clampedWidth
			}));
		}
	};
}

export const drawerStore = createDrawerStore();
