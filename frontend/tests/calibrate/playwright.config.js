// @ts-check
import path from 'path';
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env') });

/**
 * Playwright config for the load-test calibration recorder only. It drives a
 * real browser against an already running app (CALIBRATE_URL) and never
 * starts a dev server. Not part of the e2e suite (`*.calibrate.js`).
 * @see loadtest/README.md
 */
export default defineConfig({
	testDir: '.',
	testMatch: '*.calibrate.js',
	workers: 1,
	retries: 0,
	timeout: 180_000,
	reporter: 'list',
	use: {
		baseURL: process.env.CALIBRATE_URL || 'http://localhost:5173',
		viewport: { width: 1600, height: 900 },
		ignoreHTTPSErrors: true
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } }
		}
	]
});
