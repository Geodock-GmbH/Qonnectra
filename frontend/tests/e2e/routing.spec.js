// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Routing functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication - this would depend on your actual auth implementation
    // For example, setting cookies or local storage values
    await page.context().addCookies([
      {
        name: 'api-access-token',
        value: 'mock-auth-token',
        domain: 'localhost',
        path: '/',
      }
    ]);
    
    // Navigate to the trench page
    await page.goto('/trench/1/1');
  });

  test('should display the trench page with map and controls', async ({ page }) => {
    // Verify the page has loaded correctly
    await expect(page.locator('.grid-cols-1')).toBeVisible();
    await expect(page.locator('text=Conduit')).toBeVisible();
    
    // Verify map is visible
    const mapElement = page.locator('.ol-viewport');
    await expect(mapElement).toBeVisible();
  });

  test('should toggle routing mode', async ({ page }) => {
    // Find and click the routing mode switch
    const routingModeSwitch = page.locator('text=Routing Mode').locator('..').locator('switch');
    await routingModeSwitch.click();
    
    // Verify the switch is toggled on
    // This depends on your UI implementation, might need adjustment
    await expect(page.locator('switch[checked]')).toBeVisible();
  });

  test('should show error when no conduit is selected', async ({ page }) => {
    // Mock the map click event
    await page.evaluate(() => {
      // Simulate a map click event
      const mapElement = document.querySelector('.ol-viewport');
      if (mapElement) {
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        mapElement.dispatchEvent(clickEvent);
      }
    });
    
    // Verify error toast appears
    await expect(page.locator('text=No conduit selected')).toBeVisible();
  });

  test('should handle routing API requests', async ({ page }) => {
    // Mock the API response for routing
    await page.route('/api/routing', async (route) => {
      const requestBody = JSON.parse(route.request().postData() || '{}');
      
      // Verify the request contains the expected parameters
      expect(requestBody).toHaveProperty('startTrenchId');
      expect(requestBody).toHaveProperty('endTrenchId');
      expect(requestBody).toHaveProperty('projectId');
      expect(requestBody).toHaveProperty('tolerance');
      
      // Mock a successful response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          path_geometry_wkt: 'LINESTRING(0 0, 1 1, 2 2)',
          traversed_trench_uuids: ['uuid1', 'uuid2', 'uuid3'],
          traversed_trench_ids: ['101', '102', '103']
        })
      });
    });
    
    // Select a conduit (this would depend on your UI)
    await page.locator('text=Conduit').click();
    await page.locator('text=Select a conduit').click();
    await page.getByRole('option').first().click();
    
    // Enable routing mode
    const routingModeSwitch = page.locator('text=Routing Mode').locator('..').locator('switch');
    await routingModeSwitch.click();
    
    // Simulate two map clicks for start and end points
    // This is a simplified simulation - in a real test you might need to interact with the actual map
    await page.evaluate(() => {
      // Create a mock feature for the map click handler
      const mockFeature = {
        get: (key) => key === 'id_trench' ? '101' : null,
        getId: () => 'uuid1'
      };
      
      // Access the map instance and trigger the click handler
      const mapInstance = window.olMapInstance;
      if (mapInstance) {
        // Simulate first click
        mapInstance.dispatchEvent({
          type: 'click',
          pixel: [100, 100],
          coordinate: [0, 0],
          // Mock the getFeaturesAtPixel method to return our mock feature
          preventDefault: () => {},
          stopPropagation: () => {}
        });
        
        // Change the mock feature for second click
        mockFeature.get = (key) => key === 'id_trench' ? '103' : null;
        mockFeature.getId = () => 'uuid3';
        
        // Simulate second click
        mapInstance.dispatchEvent({
          type: 'click',
          pixel: [200, 200],
          coordinate: [2, 2],
          preventDefault: () => {},
          stopPropagation: () => {}
        });
      }
    });
    
    // Verify the trench table updates with the routed trenches
    // This would depend on your UI implementation
    await expect(page.locator('text=101')).toBeVisible();
    await expect(page.locator('text=103')).toBeVisible();
  });

  test('should handle routing errors', async ({ page }) => {
    // Mock the API to return an error
    await page.route('/api/routing', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'No path found between trenches'
        })
      });
    });
    
    // Select a conduit
    await page.locator('text=Conduit').click();
    await page.locator('text=Select a conduit').click();
    await page.getByRole('option').first().click();
    
    // Enable routing mode
    const routingModeSwitch = page.locator('text=Routing Mode').locator('..').locator('switch');
    await routingModeSwitch.click();
    
    // Simulate two map clicks
    await page.evaluate(() => {
      // Similar to previous test but will trigger the error path
      // Implementation details would depend on your actual code
    });
    
    // Verify error toast appears
    await expect(page.locator('text=Error calculating route')).toBeVisible();
    await expect(page.locator('text=No path found between trenches')).toBeVisible();
  });
});