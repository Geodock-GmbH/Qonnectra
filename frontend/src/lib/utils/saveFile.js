/** @type {Record<string, { description: string, mime: string }>} */
const FILE_TYPES = {
	'.zip': { description: 'ZIP Archive', mime: 'application/zip' },
	'.geojson': { description: 'GeoJSON File', mime: 'application/geo+json' },
	'.json': { description: 'JSON File', mime: 'application/json' },
	'.csv': { description: 'CSV File', mime: 'text/csv' },
	'.xlsx': {
		description: 'Excel Spreadsheet',
		mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	},
	'.pdf': { description: 'PDF Document', mime: 'application/pdf' }
};

/**
 * Prompts the user to choose a save location via the File System Access API,
 * falling back to an anchor-based download when unsupported.
 * @param {Blob} blob
 * @param {string} suggestedName
 */
export async function saveFile(blob, suggestedName) {
	if (typeof (/** @type {any} */ (window).showSaveFilePicker) === 'function') {
		await saveWithPicker(blob, suggestedName);
	} else {
		saveWithAnchor(blob, suggestedName);
	}
}

/**
 * @param {Blob} blob
 * @param {string} suggestedName
 */
async function saveWithPicker(blob, suggestedName) {
	const ext = suggestedName.includes('.')
		? suggestedName.slice(suggestedName.lastIndexOf('.'))
		: '';
	const fileType = FILE_TYPES[ext];

	/** @type {Array<{description: string, accept: Record<string, string[]>}>} */
	const types = fileType
		? [{ description: fileType.description, accept: { [fileType.mime]: [ext] } }]
		: [];

	let handle;
	try {
		handle = await /** @type {any} */ (window).showSaveFilePicker({ suggestedName, types });
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') return;
		throw err;
	}

	const writable = await handle.createWritable();
	await writable.write(blob);
	await writable.close();
}

/**
 * @param {Blob} blob
 * @param {string} suggestedName
 */
function saveWithAnchor(blob, suggestedName) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = suggestedName;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
