import { get, writable } from 'svelte/store';

import { drawerWidth } from '$lib/stores/store';

/**
 * @typedef {Object} DrawerState
 * @property {boolean} open
 * @property {string} title
 * @property {any} component
 * @property {Record<string, any>} props
 * @property {number} width
 */

/**
 * @typedef {Object} DrawerStore
 * @property {(cb: (value: DrawerState) => void) => import('svelte/store').Unsubscriber} subscribe - Subscribe to state changes
 * @property {(options?: {title?: string, component?: any, props?: Record<string, any>, width?: number | null}) => void} open - Opens the drawer with configuration
 * @property {() => void} close - Closes the drawer
 * @property {(title: string) => void} setTitle - Updates the drawer title
 * @property {(component: any, props?: Record<string, any>) => void} setComponent - Updates the drawer component
 * @property {(width: number) => void} setWidth - Sets the drawer width with clamping
 * @property {(newProps: Record<string, any>) => void} updateProps - Merges new props with existing
 */

/**
 * Creates a Svelte store for managing drawer state.
 * Provides methods to control drawer visibility, content, and dimensions.
 * @returns {DrawerStore} Drawer store with state management methods
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
		 * @param {any} [options.component=null] - Svelte component to render in drawer
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
		 * @param {any} component - Svelte component to render
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
		},
		/**
		 * Updates specific props without replacing all props
		 * @param {Object} newProps - Props to merge with existing props
		 */
		updateProps: (newProps) => {
			update((store) => ({
				...store,
				props: {
					...store.props,
					...newProps
				}
			}));
		}
	};
}

export const drawerStore = createDrawerStore();
