import adapter from '@sveltejs/adapter-node';

export default {
	kit: {
		adapter: adapter(),
		csrf: {
			trustedOrigins: ['*'] // Rely on Django's CSRF protection
		}
	}
};
