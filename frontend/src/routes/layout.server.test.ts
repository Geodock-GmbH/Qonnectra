import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { load } from './+layout.server';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => {
		const redirectError = new Error('redirect') as Error & { status: number; location: string };
		redirectError.status = status;
		redirectError.location = location;
		throw redirectError;
	}
}));

vi.mock('../hooks.server.js', () => ({
	PUBLIC_ROUTES: ['/login', '/logout']
}));

function makeCookies(values: Record<string, string>): Cookies {
	return { get: (name: string) => values[name] } as unknown as Cookies;
}

function makeUrl(pathname: string): URL {
	return new URL(`http://localhost:5173${pathname}`);
}

function okJson(data: unknown) {
	return { ok: true, json: () => Promise.resolve(data) };
}

const authenticatedLocals = { user: { isAuthenticated: true, username: 'malte' } };

function makeFetch() {
	return vi.fn((url: string) => {
		if (url.includes('flags/')) {
			return Promise.resolve(okJson([{ id: 1, flag: 'Bau' }]));
		}
		if (url.includes('projects/')) {
			return Promise.resolve(okJson({ results: [{ id: 7, project: 'Ausbau Nord' }] }));
		}
		return Promise.resolve(okJson({ srid: 25832, proj4: '+proj=utm +zone=32' }));
	});
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('root layout load', () => {
	test('should redirect unauthenticated users to login with a return path', async () => {
		await expect(
			load({
				locals: { user: null },
				url: makeUrl('/map/7?foo=bar'),
				fetch: vi.fn(),
				cookies: makeCookies({})
			} as never)
		).rejects.toMatchObject({
			status: 303,
			location: '/login?redirectTo=%2Fmap%2F7%3Ffoo%3Dbar'
		});
	});

	test('should not redirect on public routes', async () => {
		const result = (await load({
			locals: { user: null },
			url: makeUrl('/login'),
			fetch: vi.fn(),
			cookies: makeCookies({})
		} as never)) as Record<string, unknown>;

		expect(result.user).toBeNull();
		expect(result.flags).toEqual([]);
	});

	test('should load flags, projects, and config for authenticated users', async () => {
		const fetchMock = makeFetch();

		const result = (await load({
			locals: authenticatedLocals,
			url: makeUrl('/map/7'),
			fetch: fetchMock,
			cookies: makeCookies({ 'api-access-token': 'tok' })
		} as never)) as Record<string, unknown>;

		expect(result.flags).toEqual([{ label: 'Bau', value: '1' }]);
		expect(result.projects).toEqual([{ label: 'Ausbau Nord', value: '7' }]);
		expect(result.srid).toBe(25832);
		expect(result.proj4Def).toBe('+proj=utm +zone=32');
		expect(result.flagsError).toBeNull();
		expect(result.projectsError).toBeNull();
		expect(typeof result.appVersion).toBe('string');
	});

	test('should fall back to the first project when no cookie is set', async () => {
		const result = (await load({
			locals: authenticatedLocals,
			url: makeUrl('/map'),
			fetch: makeFetch(),
			cookies: makeCookies({})
		} as never)) as Record<string, unknown>;

		expect(result.selectedProject).toBe('7');
	});

	test('should prefer the selected-project cookie', async () => {
		const result = (await load({
			locals: authenticatedLocals,
			url: makeUrl('/map'),
			fetch: makeFetch(),
			cookies: makeCookies({ 'selected-project': '3' })
		} as never)) as Record<string, unknown>;

		expect(result.selectedProject).toBe('3');
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

		const result = (await load({
			locals: authenticatedLocals,
			url: makeUrl('/map'),
			fetch: fetchMock,
			cookies: makeCookies({})
		} as never)) as Record<string, unknown>;

		expect(result.flagsError).toBe('Failed to fetch flags');
		expect(result.projectsError).toBe('Failed to fetch projects');
		expect(result.selectedProject).toBe('1');
	});
});
