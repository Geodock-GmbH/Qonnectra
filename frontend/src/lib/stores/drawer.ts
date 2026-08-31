import type { Component } from 'svelte';
import type { Unsubscriber } from 'svelte/store';
import { get, writable } from 'svelte/store';

import { drawerWidth } from '$lib/stores/store';

/** A Svelte 5 component rendered inside the drawer, with arbitrary props. */
export type DrawerComponent = Component<Record<string, unknown>>;
export type DrawerProps = Record<string, unknown>;

export interface DrawerState {
	open: boolean;
	title: string;
	component: DrawerComponent | null;
	props: DrawerProps;
	width: number;
}

export interface DrawerStore {
	subscribe: (cb: (value: DrawerState) => void) => Unsubscriber;
	open: (options?: {
		title?: string;
		component?: DrawerComponent | null;
		props?: DrawerProps;
		width?: number | null;
	}) => void;
	close: () => void;
	setTitle: (title: string) => void;
	setComponent: (component: DrawerComponent | null, props?: DrawerProps) => void;
	setWidth: (width: number) => void;
	updateProps: (newProps: DrawerProps) => void;
}

/**
 * Creates a Svelte store for managing drawer state.
 * Provides methods to control drawer visibility, content, and dimensions.
 */
function createDrawerStore(): DrawerStore {
	const { subscribe, set, update } = writable<DrawerState>({
		open: false,
		title: '',
		component: null,
		props: {},
		width: 400
	});

	return {
		subscribe,
		open: ({
			title = '',
			component = null,
			props = {},
			width = null
		}: {
			title?: string;
			component?: DrawerComponent | null;
			props?: DrawerProps;
			width?: number | null;
		} = {}) => {
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
		setTitle: (title: string) => {
			update((store) => ({
				...store,
				title
			}));
		},
		setComponent: (component: DrawerComponent | null, props: DrawerProps = {}) => {
			update((store) => ({
				...store,
				component,
				props
			}));
		},
		/**
		 * Sets the drawer width with automatic clamping.
		 * Ensures width stays between 200px (minimum) and 80% of viewport width (maximum).
		 * Persists the clamped width to localStorage.
		 */
		setWidth: (width: number) => {
			const maxWidth = Math.floor(window.innerWidth * 0.8);
			const clampedWidth = Math.max(200, Math.min(width, maxWidth));
			drawerWidth.set(clampedWidth);
			update((store) => ({
				...store,
				width: clampedWidth
			}));
		},
		updateProps: (newProps: DrawerProps) => {
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
