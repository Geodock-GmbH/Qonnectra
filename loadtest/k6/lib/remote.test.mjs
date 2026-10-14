/**
 * Checks the k6 remote-function encoder against SvelteKit's own implementation
 * from frontend/node_modules, so a SvelteKit upgrade that changes the wire
 * format fails here instead of silently turning every remote call into a 400.
 * Run: node --test loadtest/k6/lib/
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { parse_remote_arg } from '../../../frontend/node_modules/@sveltejs/kit/src/runtime/shared.js';
import { hash } from '../../../frontend/node_modules/@sveltejs/kit/src/utils/hash.js';
import { base64UrlEncode, encodeRemoteArg, kitHash, REMOTE } from './remote.js';

test('kitHash matches SvelteKit hash for remote module paths', () => {
	for (const file of [
		'src/lib/remote/map/layers.remote.ts',
		'src/lib/remote/network-schema/fibers.remote.ts',
		'äöü/ß'
	]) {
		assert.equal(kitHash(file), hash(file));
	}
});

test('encoded args round-trip through SvelteKit parse_remote_arg', () => {
	const args = [
		'7c2a0c5e-6d6e-4c38-9a0f-0d2f7a8b1c11',
		{ searchQuery: 'Teststraße 12', projectId: '3' },
		{ featureType: 'trench', featureUuid: 'abc', projectId: '' },
		{ projectId: '1', search: '', page: 2, pageSize: 50 },
		{ nested: { list: [1, 'two', null, true] } }
	];
	for (const arg of args) {
		assert.deepEqual(parse_remote_arg(encodeRemoteArg(arg), {}), arg);
	}
	assert.equal(encodeRemoteArg(undefined), '');
});

test('base64UrlEncode matches Buffer base64url', () => {
	for (const text of ['', 'a', 'ab', 'abc', 'Straße ü €', '[{"a":1},"x"]']) {
		assert.equal(base64UrlEncode(text), Buffer.from(text, 'utf8').toString('base64url'));
	}
});

test('every remote function the scenarios call still exists', () => {
	for (const id of Object.values(REMOTE)) {
		const [, name] = id.split('/');
		const file = Object.entries({
			'map/layers': ['getLayerStyleAttributes', 'getLayerExtent'],
			'map/feature-search': ['searchFeatures', 'getFeatureDetails'],
			'map/trenches': ['getConduitsInTrench', 'getCablesInTrench', 'getTrenchProfile'],
			'network-schema/nodes': ['getNodeDetails'],
			'network-schema/cables': ['getCableDetails'],
			'network-schema/fibers': ['getFibersForCable'],
			'conduit/conduits': ['getConduitList']
		}).find(([, names]) => names.includes(name))?.[0];
		assert.ok(file, `${name} is not mapped to a remote file`);
		const source = readFileSync(
			new URL(`../../../frontend/src/lib/remote/${file}.remote.ts`, import.meta.url),
			'utf8'
		);
		assert.match(source, new RegExp(`export const ${name} = query\\(`));
		assert.ok(id.startsWith(`${kitHash(`src/lib/remote/${file}.remote.ts`)}/`));
	}
});
