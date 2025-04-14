import { getContext, setContext } from 'svelte';

// Define a unique key for the context
const AUTH_CONTEXT_KEY = Symbol('auth_context');

/**
 * @typedef {object} UserData
 * @property {boolean} isAuthenticated
 * @property {number} [pk]
 * @property {string} [username]
 * @property {string} [email]
 * // Add other user properties received from the API as needed
 */

/**
 * Sets the user authentication context. Should be called in a parent component (like +layout.svelte).
 * @param {UserData} user The user data object from the server load function.
 */
export function setAuthContext(user) {
	setContext(AUTH_CONTEXT_KEY, user);
}

/**
 * Gets the user authentication context. Should be called in child components.
 * Throws error if called outside context provider. Consider providing default value if needed.
 * @returns {UserData} The user data object.
 */
export function getAuthContext() {
	const context = getContext(AUTH_CONTEXT_KEY);
	if (!context) {
		// This shouldn't happen if used correctly within the layout structure
		// but provides a fallback/error.
		console.error('Auth context not found!');
		return { isAuthenticated: false };
	}
	return /** @type {UserData} */ (context);
}
