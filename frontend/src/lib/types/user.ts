import type { Permissions } from '$lib/utils/permissions';

/**
 * The signed-in user as resolved by `handleAuth` and loaded by the root
 * layout, so it is on `page.data.user` for every page.
 */
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
