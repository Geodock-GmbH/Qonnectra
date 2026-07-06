// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { saveFile } from './saveFile.js';

/** @type {any} */
const win = window;

describe('saveFile', () => {
	/** @type {any} */
	let originalShowSaveFilePicker;

	beforeEach(() => {
		originalShowSaveFilePicker = win.showSaveFilePicker;
	});

	afterEach(() => {
		win.showSaveFilePicker = originalShowSaveFilePicker;
		vi.restoreAllMocks();
	});

	describe('when showSaveFilePicker is supported', () => {
		test('should open a save dialog and write the blob to the chosen file', async () => {
			const blob = new Blob(['test content'], { type: 'application/zip' });
			const writableStream = { write: vi.fn(), close: vi.fn() };
			const fileHandle = { createWritable: vi.fn(() => writableStream) };

			win.showSaveFilePicker = vi.fn(() => Promise.resolve(fileHandle));

			await saveFile(blob, 'export.zip');

			expect(win.showSaveFilePicker).toHaveBeenCalledWith({
				suggestedName: 'export.zip',
				types: [
					{
						description: 'ZIP Archive',
						accept: { 'application/zip': ['.zip'] }
					}
				]
			});
			expect(fileHandle.createWritable).toHaveBeenCalled();
			expect(writableStream.write).toHaveBeenCalledWith(blob);
			expect(writableStream.close).toHaveBeenCalled();
		});

		test('should silently handle user cancellation (AbortError)', async () => {
			const blob = new Blob(['test'], { type: 'application/zip' });
			const abortError = new DOMException('The user aborted a request.', 'AbortError');

			win.showSaveFilePicker = vi.fn(() => Promise.reject(abortError));

			await expect(saveFile(blob, 'export.zip')).resolves.toBeUndefined();
		});

		test('should rethrow non-abort errors from showSaveFilePicker', async () => {
			const blob = new Blob(['test'], { type: 'application/zip' });
			const securityError = new DOMException('Not allowed', 'SecurityError');

			win.showSaveFilePicker = vi.fn(() => Promise.reject(securityError));

			await expect(saveFile(blob, 'export.zip')).rejects.toThrow('Not allowed');
		});
	});

	describe('when showSaveFilePicker is not supported', () => {
		test('should fall back to anchor-download', async () => {
			delete win.showSaveFilePicker;

			const blob = new Blob(['test content'], { type: 'application/zip' });

			const createObjectURLMock = vi.fn(() => 'blob:mock-url');
			const revokeObjectURLMock = vi.fn();
			vi.stubGlobal('URL', {
				...URL,
				createObjectURL: createObjectURLMock,
				revokeObjectURL: revokeObjectURLMock
			});

			const clickMock = vi.fn();
			const removeMock = vi.fn();
			const anchorElement = { href: '', download: '', click: clickMock, remove: removeMock };
			vi.spyOn(document, 'createElement').mockReturnValue(/** @type {any} */ (anchorElement));
			vi.spyOn(document.body, 'appendChild').mockImplementation((/** @type {any} */ el) => el);

			await saveFile(blob, 'export.zip');

			expect(createObjectURLMock).toHaveBeenCalledWith(blob);
			expect(anchorElement.href).toBe('blob:mock-url');
			expect(anchorElement.download).toBe('export.zip');
			expect(clickMock).toHaveBeenCalled();
			expect(removeMock).toHaveBeenCalled();
			expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
		});
	});

	describe('file type detection', () => {
		test('should use correct file type options for geojson files', async () => {
			const blob = new Blob(['{}'], { type: 'application/geo+json' });
			const writableStream = { write: vi.fn(), close: vi.fn() };
			const fileHandle = { createWritable: vi.fn(() => writableStream) };

			win.showSaveFilePicker = vi.fn(() => Promise.resolve(fileHandle));

			await saveFile(blob, 'data.geojson');

			expect(win.showSaveFilePicker).toHaveBeenCalledWith({
				suggestedName: 'data.geojson',
				types: [
					{
						description: 'GeoJSON File',
						accept: { 'application/geo+json': ['.geojson'] }
					}
				]
			});
		});

		test('should use generic type for unknown extensions', async () => {
			const blob = new Blob(['data'], { type: 'application/octet-stream' });
			const writableStream = { write: vi.fn(), close: vi.fn() };
			const fileHandle = { createWritable: vi.fn(() => writableStream) };

			win.showSaveFilePicker = vi.fn(() => Promise.resolve(fileHandle));

			await saveFile(blob, 'file.xyz');

			expect(win.showSaveFilePicker).toHaveBeenCalledWith({
				suggestedName: 'file.xyz',
				types: []
			});
		});
	});
});
