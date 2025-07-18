import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server';

// Mock environment variables
vi.mock('$env/static/private', () => ({
  API_URL: 'http://mock-api.test/'
}));

// Mock SvelteKit's json function
vi.mock('@sveltejs/kit', () => ({
  json: (data, options) => ({ body: data, status: options?.status || 200 })
}));

describe('Routing API Server Route', () => {
  let mockRequest;
  let mockCookies;
  let mockFetch;

  beforeEach(() => {
    // Reset mocks before each test
    mockRequest = {
      json: vi.fn()
    };
    
    mockCookies = {
      get: vi.fn()
    };
    
    // Create a global fetch mock
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  it('should return 400 when required parameters are missing', async () => {
    // Missing endTrenchId
    mockRequest.json.mockResolvedValue({
      startTrenchId: '123',
      projectId: '1',
      tolerance: 1
    });

    const response = await POST({ request: mockRequest, cookies: mockCookies });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Missing required parameters');
  });

  it('should forward authentication cookies to backend', async () => {
    // Setup request with all required parameters
    mockRequest.json.mockResolvedValue({
      startTrenchId: '123',
      endTrenchId: '456',
      projectId: '1',
      tolerance: 1
    });
    
    // Setup auth cookie
    mockCookies.get.mockReturnValue('test-auth-token');
    
    // Setup successful backend response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 
        path_geometry_wkt: 'LINESTRING(0 0, 1 1)',
        traversed_trench_uuids: ['uuid1', 'uuid2'],
        traversed_trench_ids: ['123', '456']
      })
    });

    await POST({ request: mockRequest, cookies: mockCookies });
    
    // Verify the fetch call included the auth cookie
    expect(mockFetch).toHaveBeenCalled();
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[1].headers.get('Cookie')).toBe('api-access-token=test-auth-token');
  });

  it('should handle successful routing response', async () => {
    // Setup request
    mockRequest.json.mockResolvedValue({
      startTrenchId: '123',
      endTrenchId: '456',
      projectId: '1',
      tolerance: 1
    });
    
    // Setup successful backend response
    const mockRouteData = {
      path_geometry_wkt: 'LINESTRING(0 0, 1 1)',
      traversed_trench_uuids: ['uuid1', 'uuid2'],
      traversed_trench_ids: ['123', '456']
    };
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRouteData)
    });

    const response = await POST({ request: mockRequest, cookies: mockCookies });
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockRouteData);
  });

  it('should handle backend error responses', async () => {
    // Setup request
    mockRequest.json.mockResolvedValue({
      startTrenchId: '123',
      endTrenchId: '456',
      projectId: '1',
      tolerance: 1
    });
    
    // Setup error response from backend
    const errorMessage = 'No path found between trenches';
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve(JSON.stringify({ error: errorMessage }))
    });

    const response = await POST({ request: mockRequest, cookies: mockCookies });
    
    expect(response.status).toBe(404);
    expect(response.body.error).toBe(errorMessage);
  });

  it('should handle non-JSON error responses from backend', async () => {
    // Setup request
    mockRequest.json.mockResolvedValue({
      startTrenchId: '123',
      endTrenchId: '456',
      projectId: '1',
      tolerance: 1
    });
    
    // Setup non-JSON error response
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal server error')
    });

    const response = await POST({ request: mockRequest, cookies: mockCookies });
    
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal server error');
  });

  it('should handle exceptions during processing', async () => {
    // Setup request to throw an error
    mockRequest.json.mockRejectedValue(new Error('Request parsing failed'));

    const response = await POST({ request: mockRequest, cookies: mockCookies });
    
    expect(response.status).toBe(500);
    expect(response.body.error).toContain('Internal server error');
  });
});