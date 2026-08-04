import type { AccessLevel, Permissions } from '$lib/utils/permissions';
import { writable } from 'svelte/store';

export type { AccessLevel, Permissions };

export interface UserData {
	isAuthenticated: boolean;
	pk?: number;
	username?: string;
	email?: string;
	is_staff?: boolean;
	is_superuser?: boolean;
	isAdmin?: boolean;
	permissions?: Permissions;
}

/**
 * Writable store holding the current user authentication state.
 * Initialize with default non-authenticated state.
 */
export const userStore = writable<UserData>({ isAuthenticated: false });

/**
 * Updates the user store with new data.
 * Typically called from the root layout when server-loaded data ($page.data.user) changes.
 */
export function updateUserStore(userData: UserData | null | undefined) {
	userStore.set(userData || { isAuthenticated: false });
}
