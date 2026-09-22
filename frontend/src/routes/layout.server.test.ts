import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { load } from './+layout.server';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

function makeCookies(values: Record<string, string>): Cookies {
	return { get: (name: string) => values[name] } as unknown as Cookies;
}

/**
 * A `url` that fails on any property access. Every test passes it, which
 * proves the load has no URL dependency and so never reruns on a query,
 * hash or same-route param change.
 */
const forbiddenUrl = new Proxy({} as URL, {
	get(_target, property) {
		throw new Error(`root layout load must not read url.${String(property)}`);
	}
});

function okJson(data: unknown) {
	return { ok: true, json: () => Promise.resolve(data) };
}

const authenticatedLocals = { user: { isAuthenticated: true, username: 'malte' } };

function makeFetch() {
	return vi.fn((url: string, _init?: RequestInit) => {
		if (url.includes('flags/')) {
			return Promise.resolve(okJson([{ id: 1, flag: 'Bau' }]));
		}
		if (url.includes('projects/')) {
			return Promise.resolve(okJson({ results: [{ id: 7, project: 'Ausbau Nord' }] }));
		}
		return Promise.resolve(okJson({ srid: 25832, proj4: '+proj=utm +zone=32' }));
	});
}

/**
 * Runs the load with the forbidden URL and a recording `depends`.
 * @param overrides - Event fields to replace.
 */
function runLoad(overrides: {
	locals?: Record<string, unknown>;
	fetch?: ReturnType<typeof vi.fn>;
	cookies?: Cookies;
}) {
	const depends = vi.fn();
	const result = load({
		locals: overrides.locals ?? authenticatedLocals,
		url: forbiddenUrl,
		fetch: overrides.fetch ?? makeFetch(),
		cookies: overrides.cookies ?? makeCookies({}),
		depends
	} as never) as Promise<Record<string, unknown>>;
	return { result, depends };
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('root layout load', () => {
	test('should not read the URL and should register the reference-data dependency', async () => {
		const { result, depends } = runLoad({});

		await expect(result).resolves.toBeDefined();
		expect(depends).toHaveBeenCalledWith('app:reference-data');
	});

	test('should return empty reference data without fetching for unauthenticated users', async () => {
		const fetchMock = vi.fn();
		const { result } = runLoad({ locals: { user: { isAuthenticated: false } }, fetch: fetchMock });
		const data = await result;

		expect(data.flags).toEqual([]);
		expect(data.projects).toEqual([]);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('should load flags, projects, and config for authenticated users', async () => {
		const fetchMock = makeFetch();
		const { result } = runLoad({
			fetch: fetchMock,
			cookies: makeCookies({ 'api-access-token': 'tok' })
		});
		const data = await result;

		expect(data.flags).toEqual([{ label: 'Bau', value: '1' }]);
		expect(data.projects).toEqual([{ label: 'Ausbau Nord', value: '7' }]);
		expect(data.srid).toBe(25832);
		expect(data.proj4Def).toBe('+proj=utm +zone=32');
		expect(data.flagsError).toBeNull();
		expect(data.projectsError).toBeNull();
		expect(typeof data.appVersion).toBe('string');
	});

	test('should send the access token as a Cookie header on every reference call', async () => {
		const fetchMock = makeFetch();
		await runLoad({ fetch: fetchMock, cookies: makeCookies({ 'api-access-token': 'tok' }) }).result;

		expect(fetchMock).toHaveBeenCalledTimes(3);
		for (const [, init] of fetchMock.mock.calls) {
			expect((init as { headers: Record<string, string> }).headers).toEqual({
				Cookie: 'api-access-token=tok'
			});
		}
	});

	test('should fall back to the first project when no cookie is set', async () => {
		const { result } = runLoad({});

		expect((await result).selectedProject).toBe('7');
	});

	test('should prefer the selected-project cookie', async () => {
		const { result } = runLoad({ cookies: makeCookies({ 'selected-project': '3' }) });

		expect((await result).selectedProject).toBe('3');
	});

	test('should report errors per failing endpoint without crashing', async () => {
		const fetchMock = vi.fn((url: string) => {
			if (url.includes('flags/')) {
				return Promise.reject(new Error('offline'));
			}
			if (url.includes('projects/')) {
				return Promise.resolve({ ok: false, status: 500 });
			}
			return Promise.resolve(okJson({}));
		});
		const { result } = runLoad({ fetch: fetchMock });
		const data = await result;

		expect(data.flagsError).toBe('Failed to fetch flags');
		expect(data.projectsError).toBe('Failed to fetch projects');
		expect(data.selectedProject).toBe('1');
	});
});
