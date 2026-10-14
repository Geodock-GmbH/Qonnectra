/**
 * SvelteKit remote-function wire format, reimplemented without dependencies so
 * the same module runs in k6 and in Node (where remote.test.mjs checks it
 * against SvelteKit's own `hash` and `parse_remote_arg`).
 *
 * A query is `GET /_app/remote/{hash}/{export}?payload={arg}`, where `hash` is
 * SvelteKit's djb2 hash of the `.remote.ts` path relative to the frontend root
 * and `arg` is URL-safe base64 of the devalue-serialised argument.
 */

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * SvelteKit's `hash()` from `@sveltejs/kit/src/utils/hash.js`, strings only.
 * @param {string} value - Text to hash, e.g. `src/lib/remote/map/layers.remote.ts`.
 * @returns {string} The base-36 hash SvelteKit uses as the remote module id.
 */
export function kitHash(value) {
	let hash = 5381;
	let i = value.length;
	while (i) hash = (hash * 33) ^ value.charCodeAt(--i);
	return (hash >>> 0).toString(36);
}

/**
 * Returns the remote id of one exported remote function.
 * @param {string} file - Path of the `.remote.ts` file relative to `frontend/`.
 * @param {string} name - Exported function name.
 * @returns {string} `{hash}/{name}`, the path segment after `/_app/remote/`.
 */
function remoteId(file, name) {
	return `${kitHash(file)}/${name}`;
}

/**
 * Serialises plain JSON-like data in devalue's format: a flat array whose first
 * entry is the root, with objects and arrays referencing other entries by index.
 * Object keys are sorted like SvelteKit's remote-arg reducer does.
 * @param {unknown} value - Strings, numbers, booleans, null, arrays and plain objects.
 * @returns {string} devalue JSON text.
 */
function devalueStringify(value) {
	/** @type {unknown[]} */
	const values = [];

	/** @param {unknown} thing @returns {number} */
	function flatten(thing) {
		if (thing === undefined) return -1;
		const index = values.length;
		values.push(null);
		if (thing === null || typeof thing !== 'object') {
			values[index] = thing;
		} else if (Array.isArray(thing)) {
			values[index] = thing.map(flatten);
		} else {
			/** @type {Record<string, number>} */
			const object = {};
			for (const key of Object.keys(thing).sort()) {
				object[key] = flatten(/** @type {Record<string, unknown>} */ (thing)[key]);
			}
			values[index] = object;
		}
		return index;
	}

	flatten(value);
	return JSON.stringify(values);
}

/**
 * Encodes text as unpadded URL-safe base64 of its UTF-8 bytes.
 * @param {string} text - Text to encode.
 * @returns {string} Base64url without `=` padding.
 */
export function base64UrlEncode(text) {
	const bytes = unescape(encodeURIComponent(text));
	let out = '';
	for (let i = 0; i < bytes.length; i += 3) {
		const a = bytes.charCodeAt(i);
		const b = i + 1 < bytes.length ? bytes.charCodeAt(i + 1) : 0;
		const c = i + 2 < bytes.length ? bytes.charCodeAt(i + 2) : 0;
		const triple = (a << 16) | (b << 8) | c;
		out += BASE64_ALPHABET[(triple >> 18) & 63] + BASE64_ALPHABET[(triple >> 12) & 63];
		if (i + 1 < bytes.length) out += BASE64_ALPHABET[(triple >> 6) & 63];
		if (i + 2 < bytes.length) out += BASE64_ALPHABET[triple & 63];
	}
	return out;
}

/**
 * Encodes a remote query argument the way SvelteKit's client does.
 * @param {unknown} arg - The query argument; undefined for argument-less queries.
 * @returns {string} The `payload` query-string value.
 */
export function encodeRemoteArg(arg) {
	if (arg === undefined) return '';
	return base64UrlEncode(devalueStringify(arg));
}

/** Remote functions the scenarios call, keyed by a short name. */
export const REMOTE = {
	getLayerStyleAttributes: remoteId(
		'src/lib/remote/map/layers.remote.ts',
		'getLayerStyleAttributes'
	),
	getLayerExtent: remoteId('src/lib/remote/map/layers.remote.ts', 'getLayerExtent'),
	searchFeatures: remoteId('src/lib/remote/map/feature-search.remote.ts', 'searchFeatures'),
	getFeatureDetails: remoteId('src/lib/remote/map/feature-search.remote.ts', 'getFeatureDetails'),
	getConduitsInTrench: remoteId('src/lib/remote/map/trenches.remote.ts', 'getConduitsInTrench'),
	getCablesInTrench: remoteId('src/lib/remote/map/trenches.remote.ts', 'getCablesInTrench'),
	getTrenchProfile: remoteId('src/lib/remote/map/trenches.remote.ts', 'getTrenchProfile'),
	getNodeDetails: remoteId('src/lib/remote/network-schema/nodes.remote.ts', 'getNodeDetails'),
	getCableDetails: remoteId('src/lib/remote/network-schema/cables.remote.ts', 'getCableDetails'),
	getFibersForCable: remoteId(
		'src/lib/remote/network-schema/fibers.remote.ts',
		'getFibersForCable'
	),
	getConduitList: remoteId('src/lib/remote/conduit/conduits.remote.ts', 'getConduitList')
};
