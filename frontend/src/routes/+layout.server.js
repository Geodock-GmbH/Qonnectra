/** @type {import('./$types').LayoutServerLoad} */
export async function load({ locals }) {
	// locals.user is populated by the hooks.server.js handle function
	return {
		user: locals.user
	};
}
