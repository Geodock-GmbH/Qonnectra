import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { actions, load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	fail: (status: number, data: Record<string, unknown>) => {
		return { status, data };
	}
}));

describe('post-compaction +page.server.js', () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	let mockCookies: { get: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		vi.clearAllMocks();

		mockCookies = {
			get: vi.fn((name: string) => {
				if (name === 'api-access-token') return 'mock-token';
				return null;
			})
		};

		mockFetch = vi.fn();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('load function', () => {
		test('should fetch status developments and return mapped options', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve([
						{ id: 1, status: 'Planned' },
						{ id: 2, status: 'In Progress' }
					])
			});

			const result = (await load({
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof load>[0])) as Record<string, unknown>;

			expect(result.statusDevelopments).toEqual([
				{ value: '1', label: 'Planned' },
				{ value: '2', label: 'In Progress' }
			]);
		});

		test('should return empty array when fetch fails', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500
			});

			const result = (await load({
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof load>[0])) as Record<string, unknown>;

			expect(result.statusDevelopments).toEqual([]);
		});

		test('should return empty array on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = (await load({
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof load>[0])) as Record<string, unknown>;

			expect(result.statusDevelopments).toEqual([]);
		});

		test('should pass correct auth headers', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([])
			});

			await load({ fetch: mockFetch, cookies: mockCookies } as unknown as Parameters<
				typeof load
			>[0]);

			expect(mockFetch).toHaveBeenCalledTimes(1);
			expect(mockFetch.mock.calls[0][1].headers.Cookie).toBe('api-access-token=mock-token');
		});
	});

	describe('updateStatus action', () => {
		function createMockFormData(data: Record<string, unknown>) {
			const map = new Map(Object.entries(data));
			return { get: (key: string) => map.get(key) ?? null };
		}

		function createMockRequest(formDataObj: Record<string, unknown>) {
			return {
				formData: () => Promise.resolve(createMockFormData(formDataObj))
			} as unknown as Request;
		}

		test('should PATCH address with new status_development_id', async () => {
			const updatedAddress = {
				id: 'addr-uuid',
				properties: {
					street: 'Main St',
					housenumber: 1,
					status_development: { id: 2, status: 'In Progress' }
				}
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(updatedAddress)
			});

			const result = (await actions.updateStatus({
				request: createMockRequest({
					uuid: 'addr-uuid',
					status_development_id: '2'
				}),
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof actions.updateStatus>[0])) as Record<string, unknown>;

			expect(result.success).toBe(true);
			expect(result.address).toBeDefined();
			expect((result.address as Record<string, unknown>).street).toBe('Main St');

			const [url, options] = mockFetch.mock.calls[0];
			expect(url).toBe('http://localhost:8000/address/addr-uuid/');
			expect(options.method).toBe('PATCH');
			const body = JSON.parse(options.body);
			expect(body.status_development_id).toBe(2);
		});

		test('should return fail on API error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: () => Promise.resolve({ detail: 'Invalid status' })
			});

			const result = (await actions.updateStatus({
				request: createMockRequest({
					uuid: 'addr-uuid',
					status_development_id: '999'
				}),
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof actions.updateStatus>[0])) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).message).toBe('Invalid status');
		});

		test('should return fail on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = (await actions.updateStatus({
				request: createMockRequest({
					uuid: 'addr-uuid',
					status_development_id: '2'
				}),
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof actions.updateStatus>[0])) as Record<string, unknown>;

			expect(result.status).toBe(500);
			expect((result.data as Record<string, unknown>).message).toBe('Network error');
		});
	});

	describe('fetchAddress action', () => {
		function createMockFormData(data: Record<string, unknown>) {
			const map = new Map(Object.entries(data));
			return { get: (key: string) => map.get(key) ?? null };
		}

		function createMockRequest(formDataObj: Record<string, unknown>) {
			return {
				formData: () => Promise.resolve(createMockFormData(formDataObj))
			} as unknown as Request;
		}

		test('should fetch address, residential units, nodes and trenches in parallel', async () => {
			const addressData = {
				id: 'addr-uuid',
				properties: {
					uuid: 'addr-uuid',
					street: 'Main St',
					housenumber: 42,
					zip_code: '12345',
					city: 'Berlin',
					status_development: { id: 1, status: 'Planned' }
				}
			};

			const residentialUnits = [
				{ uuid: 'ru-1', floor: 1, side: 'left' },
				{ uuid: 'ru-2', floor: 2, side: 'right' }
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(addressData)
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(residentialUnits)
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ features: [] })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ features: [] })
			});

			const result = (await actions.fetchAddress({
				request: createMockRequest({ uuid: 'addr-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof actions.fetchAddress>[0])) as Record<string, unknown>;

			expect(result.success).toBe(true);
			expect((result.address as Record<string, unknown>).street).toBe('Main St');
			expect((result.address as Record<string, unknown>).uuid).toBe('addr-uuid');
			expect(result.residentialUnits).toHaveLength(2);

			expect(mockFetch).toHaveBeenCalledTimes(4);
			expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/address/addr-uuid/');
			expect(mockFetch.mock.calls[1][0]).toBe(
				'http://localhost:8000/residential-unit/all/?uuid_address=addr-uuid'
			);
			expect(mockFetch.mock.calls[2][0]).toBe('http://localhost:8000/node/?uuid_address=addr-uuid');
			expect(mockFetch.mock.calls[3][0]).toBe(
				'http://localhost:8000/address/addr-uuid/linked-trenches/'
			);
		});

		test('should return fail when address fetch fails', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: () => Promise.resolve({ detail: 'Not found' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([])
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ features: [] })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ features: [] })
			});

			const result = (await actions.fetchAddress({
				request: createMockRequest({ uuid: 'nonexistent' }),
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof actions.fetchAddress>[0])) as Record<string, unknown>;

			expect(result.status).toBe(404);
			expect((result.data as Record<string, unknown>).message).toBe('Not found');
		});

		test('should return empty residential units when that fetch fails', async () => {
			const addressData = {
				id: 'addr-uuid',
				properties: { street: 'Main St', housenumber: 1 }
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(addressData)
			});
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ features: [] })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ features: [] })
			});

			const result = (await actions.fetchAddress({
				request: createMockRequest({ uuid: 'addr-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof actions.fetchAddress>[0])) as Record<string, unknown>;

			expect(result.success).toBe(true);
			expect((result.address as Record<string, unknown>).street).toBe('Main St');
			expect(result.residentialUnits).toEqual([]);
		});

		test('should fetch linked nodes and microducts for the address', async () => {
			const addressData = {
				id: 'addr-uuid',
				properties: {
					uuid: 'addr-uuid',
					street: 'Main St',
					housenumber: 42
				}
			};

			const residentialUnits: unknown[] = [];

			const nodesGeoJson = {
				features: [
					{
						id: 'node-1',
						properties: {
							uuid: 'node-1',
							name: 'Node A',
							parent_node: { name: 'Parent X' }
						}
					}
				]
			};

			const microducts = [
				{
					uuid: 'md-1',
					number: 3,
					color: 'Red',
					hex_code: '#ff0000',
					uuid_conduit: {
						name: 'Conduit-1',
						conduit_type: { conduit_type: 'HDPE' }
					}
				}
			];

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(addressData)
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(residentialUnits)
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(nodesGeoJson)
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ features: [] })
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(microducts)
				});

			const result = (await actions.fetchAddress({
				request: createMockRequest({ uuid: 'addr-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof actions.fetchAddress>[0])) as Record<string, unknown>;

			expect(result.success).toBe(true);
			expect(result.linkedMicroducts).toBeDefined();
			expect(result.linkedMicroducts).toHaveLength(1);
			expect((result.linkedMicroducts as Record<string, unknown>[])[0]).toEqual({
				uuid: 'md-1',
				number: 3,
				color: 'Red',
				colorHex: '#ff0000',
				conduitName: 'Conduit-1',
				conduitType: 'HDPE',
				nodeName: 'Node A',
				nodeUuid: 'node-1',
				parentNodeName: 'Parent X'
			});

			expect(mockFetch.mock.calls[2][0]).toBe('http://localhost:8000/node/?uuid_address=addr-uuid');
			expect(mockFetch.mock.calls[4][0]).toBe(
				'http://localhost:8000/microduct/all/?uuid_node=node-1'
			);
		});

		test('should return empty linkedMicroducts when address has no linked nodes', async () => {
			const addressData = {
				id: 'addr-uuid',
				properties: { street: 'Main St', housenumber: 1 }
			};

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(addressData)
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve([])
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ features: [] })
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ features: [] })
				});

			const result = (await actions.fetchAddress({
				request: createMockRequest({ uuid: 'addr-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof actions.fetchAddress>[0])) as Record<string, unknown>;

			expect(result.success).toBe(true);
			expect(result.linkedMicroducts).toEqual([]);
		});

		test('should return empty linkedMicroducts when node fetch fails', async () => {
			const addressData = {
				id: 'addr-uuid',
				properties: { street: 'Main St', housenumber: 1 }
			};

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(addressData)
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve([])
				})
				.mockResolvedValueOnce({
					ok: false,
					status: 500
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ features: [] })
				});

			const result = (await actions.fetchAddress({
				request: createMockRequest({ uuid: 'addr-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof actions.fetchAddress>[0])) as Record<string, unknown>;

			expect(result.success).toBe(true);
			expect(result.linkedMicroducts).toEqual([]);
		});

		test('should extract properties from GeoJSON format', async () => {
			const geoJsonAddress = {
				id: 'addr-uuid',
				type: 'Feature',
				properties: {
					uuid: 'addr-uuid',
					street: 'GeoJSON St',
					housenumber: 10,
					geom_3857: { type: 'Point', coordinates: [1, 2] }
				},
				geometry: { type: 'Point', coordinates: [1, 2] }
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(geoJsonAddress)
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([])
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ features: [] })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ features: [] })
			});

			const result = (await actions.fetchAddress({
				request: createMockRequest({ uuid: 'addr-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof actions.fetchAddress>[0])) as Record<string, unknown>;

			expect((result.address as Record<string, unknown>).street).toBe('GeoJSON St');
			expect((result.address as Record<string, unknown>).uuid).toBe('addr-uuid');
		});

		test('should explicitly extract geom_3857 from address response', async () => {
			const addressData = {
				id: 'addr-uuid',
				properties: {
					uuid: 'addr-uuid',
					street: 'Main St',
					housenumber: 1,
					geom_3857: { type: 'Point', coordinates: [1489199.5, 6894018.3] }
				}
			};

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(addressData)
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve([])
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ features: [] })
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ features: [] })
				});

			const result = (await actions.fetchAddress({
				request: createMockRequest({ uuid: 'addr-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof actions.fetchAddress>[0])) as Record<string, unknown>;

			expect((result.address as Record<string, unknown>).geom_3857).toEqual({
				type: 'Point',
				coordinates: [1489199.5, 6894018.3]
			});
		});

		test('should set geom_3857 to null when not present in response', async () => {
			const addressData = {
				id: 'addr-uuid',
				properties: {
					uuid: 'addr-uuid',
					street: 'Main St',
					housenumber: 1
				}
			};

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(addressData)
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve([])
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ features: [] })
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ features: [] })
				});

			const result = (await actions.fetchAddress({
				request: createMockRequest({ uuid: 'addr-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof actions.fetchAddress>[0])) as Record<string, unknown>;

			expect((result.address as Record<string, unknown>).geom_3857).toBeNull();
		});

		test('should fetch and return linked trench geometries', async () => {
			const addressData = {
				id: 'addr-uuid',
				properties: { uuid: 'addr-uuid', street: 'Main St', housenumber: 1 }
			};

			const trenchFeatures = [
				{
					type: 'Feature',
					geometry: {
						type: 'LineString',
						coordinates: [
							[1, 2],
							[3, 4]
						]
					},
					properties: { name: 'Trench 1' }
				},
				{
					type: 'Feature',
					geometry: {
						type: 'LineString',
						coordinates: [
							[5, 6],
							[7, 8]
						]
					},
					properties: { name: 'Trench 2' }
				}
			];

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(addressData)
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve([])
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ features: [] })
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ features: trenchFeatures })
				});

			const result = (await actions.fetchAddress({
				request: createMockRequest({ uuid: 'addr-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof actions.fetchAddress>[0])) as Record<string, unknown>;

			expect(result.linkedTrenchGeometries).toHaveLength(2);
			expect((result.linkedTrenchGeometries as Record<string, unknown>[])[0].properties).toEqual({
				name: 'Trench 1'
			});
			expect(
				(
					(result.linkedTrenchGeometries as Record<string, unknown>[])[1].geometry as Record<
						string,
						unknown
					>
				).type
			).toBe('LineString');
		});

		test('should return empty trench geometries when linked-trenches fetch fails', async () => {
			const addressData = {
				id: 'addr-uuid',
				properties: { uuid: 'addr-uuid', street: 'Main St', housenumber: 1 }
			};

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(addressData)
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve([])
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ features: [] })
				})
				.mockResolvedValueOnce({
					ok: false,
					status: 500
				});

			const result = (await actions.fetchAddress({
				request: createMockRequest({ uuid: 'addr-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof actions.fetchAddress>[0])) as Record<string, unknown>;

			expect(result.success).toBe(true);
			expect(result.linkedTrenchGeometries).toEqual([]);
		});
	});
});
