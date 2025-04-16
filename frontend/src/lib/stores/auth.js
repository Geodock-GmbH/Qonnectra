import { writable } from 'svelte/store';

/**
 * @typedef {object} UserData
 * @property {boolean} isAuthenticated
 * @property {number} [pk]
 * @property {string} [username]
 * @property {string} [email]
 * // Add other user properties received from the API as needed
 */

/**
 * Writable store holding the current user authentication state.
 * Initialize with default non-authenticated state.
 * @type {import('svelte/store').Writable<UserData>}
 */
export const userStore = writable({ isAuthenticated: false });

/**
 * Updates the user store with new data.
 * Typically called from the root layout when server-loaded data ($page.data.user) changes.
 * @param {UserData | null | undefined} userData The user data from the server or null/undefined if not authenticated.
 */
export function updateUserStore(userData) {
	userStore.set(userData || { isAuthenticated: false });
}
