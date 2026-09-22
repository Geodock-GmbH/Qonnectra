import { describe, expect, test } from 'vitest';

import { isNetworkSchemaRoute } from './routes';

describe('isNetworkSchemaRoute', () => {
	test('should match the schema overview and its node view', () => {
		expect(isNetworkSchemaRoute('/network-schema/[[projectId]]')).toBe(true);
		expect(isNetworkSchemaRoute('/network-schema/[[projectId]]/node/[nodeId]')).toBe(true);
	});

	test('should reject other routes and the idle state', () => {
		expect(isNetworkSchemaRoute('/map/[[projectId]]')).toBe(false);
		expect(isNetworkSchemaRoute('/network-schema-export')).toBe(false);
		expect(isNetworkSchemaRoute(null)).toBe(false);
		expect(isNetworkSchemaRoute(undefined)).toBe(false);
	});
});
