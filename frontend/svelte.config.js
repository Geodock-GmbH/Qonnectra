import adapter from '@sveltejs/adapter-node';

export default {
	kit: {
		adapter: adapter(),
		csrf: {
			checkOrigin: false // Disable built-in origin checking
		}
	}
};
