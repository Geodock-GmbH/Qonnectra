import { describe, expect, test } from 'vitest';

import {
	isNetworkSchemaChildView,
	isNetworkSchemaRoute,
	isProjectRoute,
	permissionKeyFor
} from './routes';

describe('isNetworkSchemaRoute', () => {
	test('should match the schema overview and its node view', () => {
		expect(isNetworkSchemaRoute('/project/[projectId=integer]/network-schema')).toBe(true);
		expect(isNetworkSchemaRoute('/project/[projectId=integer]/network-schema/node/[nodeId]')).toBe(
			true
		);
	});

	test('should reject other routes and the idle state', () => {
		expect(isNetworkSchemaRoute('/project/[projectId=integer]/map')).toBe(false);
		expect(isNetworkSchemaRoute('/network-schema-export')).toBe(false);
		expect(isNetworkSchemaRoute(null)).toBe(false);
		expect(isNetworkSchemaRoute(undefined)).toBe(false);
	});
});

describe('isNetworkSchemaChildView', () => {
	test('should be true only for the node view', () => {
		expect(
			isNetworkSchemaChildView('/project/[projectId=integer]/network-schema/node/[nodeId]')
		).toBe(true);
		expect(isNetworkSchemaChildView('/project/[projectId=integer]/network-schema')).toBe(false);
		expect(isNetworkSchemaChildView(null)).toBe(false);
	});
});

describe('isProjectRoute', () => {
	test('should recognise the project root and its pages', () => {
		expect(isProjectRoute('/project/[projectId=integer]')).toBe(true);
		expect(isProjectRoute('/project/[projectId=integer]/map')).toBe(true);
		expect(isProjectRoute('/trace')).toBe(false);
		expect(isProjectRoute(null)).toBe(false);
	});
});

describe('permissionKeyFor', () => {
	test('should strip the project prefix and parameter segments', () => {
		expect(permissionKeyFor('/project/[projectId=integer]/valuation')).toBe('/valuation');
		expect(permissionKeyFor('/project/[projectId=integer]/network-schema/node/[nodeId]')).toBe(
			'/network-schema/node'
		);
		expect(permissionKeyFor('/project/[projectId=integer]/dashboard/[[flagId]]')).toBe(
			'/dashboard'
		);
		expect(permissionKeyFor('/project/[projectId=integer]/address/[uuid]/unit/[unitUuid]')).toBe(
			'/address/unit'
		);
	});

	test('should keep global routes as they are, without parameters', () => {
		expect(permissionKeyFor('/admin/logs')).toBe('/admin/logs');
		expect(permissionKeyFor('/trace/[entryType=traceEntryType]/[uuid]')).toBe('/trace');
		expect(permissionKeyFor('/')).toBe('/');
		expect(permissionKeyFor('/project/[projectId=integer]')).toBe('/');
	});

	test('should return null when no route matched', () => {
		expect(permissionKeyFor(null)).toBeNull();
		expect(permissionKeyFor(undefined)).toBeNull();
	});
});
