import { jsPDF } from 'jspdf';

import { m } from '$lib/paraglide/messages';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

/** @type {Record<string, [number, number, number]>} */
const COLORS = {
	slate900: [15, 23, 42],
	slate700: [51, 65, 85],
	slate500: [100, 116, 139],
	slate400: [148, 163, 184],
	slate200: [226, 232, 240],
	slate100: [241, 245, 249],
	slate50: [248, 250, 252],
	emerald600: [5, 150, 105],
	emerald500: [16, 185, 129],
	emerald100: [209, 250, 229],
	white: [255, 255, 255]
};

/**
 * Generates and downloads a PDF document for an address, optionally including residential unit pages.
 * @param {Object} params
 * @param {Record<string, any>} params.address - Address data from the API.
 * @param {Record<string, any>[]} params.residentialUnits - Residential unit objects.
 * @param {string | null} params.mapImage - Base64 data URL of the map canvas screenshot.
 * @param {boolean} params.includeResidentialUnits - Whether to append residential unit pages.
 * @param {Record<string, any>[]} [params.linkedMicroducts=[]] - Microduct connection objects.
 * @param {string[]} [params.wmsAttributions=[]] - WMS attribution strings for visible layers.
 * @param {Record<string, string>} params.labels - Translation labels for section titles and field names.
 * @returns {void}
 */
export function generateAddressPdf({
	address,
	residentialUnits,
	mapImage,
	includeResidentialUnits,
	linkedMicroducts = [],
	wmsAttributions = [],
	labels
}) {
	const doc = new jsPDF('p', 'mm', 'a4');

	buildAddressPage(doc, { address, mapImage, linkedMicroducts, wmsAttributions, labels });

	if (includeResidentialUnits && residentialUnits?.length > 0) {
		for (const unit of residentialUnits) {
			doc.addPage();
			buildResidentialUnitPage(doc, { unit, address, labels });
		}
	}

	addPageNumbers(doc);

	const filename = `${address.street}_${address.housenumber}${address.house_number_suffix || ''}.pdf`;
	doc.save(filename.replace(/\s+/g, '_'));
}

/**
 * Builds the address overview page with map, data sections, and optional microduct table.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance.
 * @param {Object} options
 * @param {Record<string, any>} options.address - Address data.
 * @param {string | null} options.mapImage - Base64 map image.
 * @param {Record<string, any>[]} options.linkedMicroducts - Microduct connections.
 * @param {string[]} [options.wmsAttributions=[]] - WMS attribution strings.
 * @param {Record<string, string>} options.labels - Translation labels.
 */
function buildAddressPage(
	doc,
	{ address, mapImage, linkedMicroducts, wmsAttributions = [], labels }
) {
	drawPageBackground(doc);

	let y = drawDocumentHeader(doc, {
		title: `${address.street} ${address.housenumber}${address.house_number_suffix || ''}`,
		subtitle: `${address.zip_code} ${address.city}${address.district ? ` · ${address.district}` : ''}`
	});

	y += 8;

	const mapColWidth = 78;
	const dataColWidth = CONTENT_WIDTH - mapColWidth - 12;
	const mapX = MARGIN + dataColWidth + 12;

	let dataY = y;

	dataY = drawSectionBlock(doc, {
		title: labels.sectionAddressInformation,
		icon: 'pin',
		y: dataY,
		x: MARGIN,
		width: dataColWidth,
		rows: [
			{ label: labels.idAddress, value: address.id_address || '–', mono: true },
			{ label: labels.street, value: address.street || '–' },
			{
				label: labels.housenumber,
				value: `${address.housenumber ?? '–'}${address.house_number_suffix ? ` ${address.house_number_suffix}` : ''}`
			},
			{ label: labels.zipCode, value: address.zip_code || '–' },
			{ label: labels.city, value: address.city || '–' },
			{ label: labels.district, value: address.district || '–' }
		]
	});

	dataY += 10;

	dataY = drawSectionBlock(doc, {
		title: labels.sectionClassification,
		icon: 'tag',
		y: dataY,
		x: MARGIN,
		width: dataColWidth,
		rows: [
			{
				label: labels.statusDevelopment,
				value: address.status_development?.status || '–',
				badge: true
			},
			{ label: labels.flag, value: address.flag?.flag || '–' },
			{ label: labels.project, value: address.project?.project || '–' }
		]
	});

	let mapY = y;

	if (mapImage) {
		mapY = drawMapSection(doc, {
			image: mapImage,
			x: mapX,
			y: mapY,
			width: mapColWidth,
			wmsAttributions
		});
		mapY += 6;
	}

	if (address.coords25832 || address.coords4326) {
		mapY = drawCoordinateCard(doc, {
			coords25832: address.coords25832,
			coords4326: address.coords4326,
			x: mapX,
			y: mapY,
			width: mapColWidth
		});
	}

	const bottomY = Math.max(dataY, mapY) + 10;

	if (linkedMicroducts?.length > 0) {
		drawMicroductTable(doc, {
			microducts: linkedMicroducts,
			y: bottomY,
			labels
		});
	}
}

/**
 * Builds a residential unit detail page with identification, classification, and fiber data.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance.
 * @param {Object} options
 * @param {Record<string, any>} options.unit - Residential unit data.
 * @param {Record<string, any>} options.address - Parent address data.
 * @param {Record<string, string>} options.labels - Translation labels.
 */
function buildResidentialUnitPage(doc, { unit, address, labels }) {
	drawPageBackground(doc);

	const addressLine = `${address.street} ${address.housenumber}${address.house_number_suffix || ''}, ${address.zip_code} ${address.city}`;

	let y = drawDocumentHeader(doc, {
		title: labels.residentialUnit,
		subtitle: addressLine
	});

	y += 8;

	const colWidth = (CONTENT_WIDTH - 12) / 2;

	let leftY = y;
	let rightY = y;

	leftY = drawSectionBlock(doc, {
		title: labels.sectionIdentification,
		icon: 'id',
		y: leftY,
		x: MARGIN,
		width: colWidth,
		rows: [
			{ label: labels.unitId, value: unit.id_residential_unit || '–', mono: true },
			{ label: labels.externalId1, value: unit.external_id_1 || '–' },
			{ label: labels.externalId2, value: unit.external_id_2 || '–' }
		]
	});

	leftY += 10;

	leftY = drawSectionBlock(doc, {
		title: labels.sectionClassification,
		icon: 'tag',
		y: leftY,
		x: MARGIN,
		width: colWidth,
		rows: [
			{
				label: labels.unitType,
				value: unit.residential_unit_type?.residential_unit_type || '–',
				badge: true
			},
			{ label: labels.unitStatus, value: unit.status?.status || '–', badge: true }
		]
	});

	const rightX = MARGIN + colWidth + 12;

	rightY = drawSectionBlock(doc, {
		title: labels.sectionUnitLocation,
		icon: 'location',
		y: rightY,
		x: rightX,
		width: colWidth,
		rows: [
			{ label: labels.floor, value: String(unit.floor ?? '–') },
			{ label: labels.side, value: unit.side || '–' },
			{ label: labels.buildingSection, value: unit.building_section || '–' }
		]
	});

	rightY += 10;

	rightY = drawSectionBlock(doc, {
		title: labels.sectionResident,
		icon: 'user',
		y: rightY,
		x: rightX,
		width: colWidth,
		rows: [
			{ label: labels.residentName, value: unit.resident_name || '–' },
			{ label: labels.residentRecordedDate, value: unit.resident_recorded_date || '–' },
			{ label: labels.readyForService, value: unit.ready_for_service || '–', badge: true }
		]
	});

	const bottomY = Math.max(leftY, rightY) + 10;

	if (unit.fiberConnections?.length > 0) {
		drawFiberTable(doc, {
			fibers: unit.fiberConnections,
			y: bottomY,
			labels
		});
	}
}

/**
 * Draws the page background with an emerald side stripe.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance.
 */
function drawPageBackground(doc) {
	doc.setFillColor(...COLORS.white);
	doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

	doc.setFillColor(...COLORS.emerald500);
	doc.rect(0, 0, 4, PAGE_HEIGHT, 'F');

	doc.setFillColor(...COLORS.emerald600);
	doc.rect(0, 0, 1.5, PAGE_HEIGHT, 'F');
}

/**
 * Draws the document header with brand, title, subtitle, and a separator line.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance.
 * @param {Object} options
 * @param {string} options.title - Main document title.
 * @param {string} options.subtitle - Subtitle text.
 * @returns {number} The Y position below the header for subsequent content.
 */
function drawDocumentHeader(doc, { title, subtitle }) {
	doc.setFillColor(...COLORS.white);
	doc.rect(0, 0, PAGE_WIDTH, 42, 'F');

	doc.setDrawColor(...COLORS.emerald500);
	doc.setLineWidth(2);
	doc.line(MARGIN, 6, MARGIN + 24, 6);

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(8);
	doc.setTextColor(...COLORS.slate500);

	const dateStr = new Date().toLocaleDateString('de-DE', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});
	doc.text(dateStr, PAGE_WIDTH - MARGIN, 8, { align: 'right' });

	doc.setFontSize(7);
	doc.setTextColor(...COLORS.emerald600);
	doc.text(m.Qonnectra(), MARGIN, 13);

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(22);
	doc.setTextColor(...COLORS.slate900);
	doc.text(title, MARGIN, 26);

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(10);
	doc.setTextColor(...COLORS.slate500);
	doc.text(subtitle, MARGIN, 34);

	doc.setDrawColor(...COLORS.slate200);
	doc.setLineWidth(0.3);
	doc.line(MARGIN, 40, PAGE_WIDTH - MARGIN, 40);

	return 48;
}

/**
 * Draws a bordered section block with a colored accent, title, and labeled data rows.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance.
 * @param {Object} options
 * @param {string} options.title - Section title (rendered uppercase).
 * @param {string} [options.icon] - Icon identifier (unused in rendering but part of the API).
 * @param {number} options.y - Top Y position in mm.
 * @param {number} options.x - Left X position in mm.
 * @param {number} options.width - Block width in mm.
 * @param {Array<{ label: string, value: string, badge?: boolean, mono?: boolean }>} options.rows - Data rows to render.
 * @returns {number} The Y position below the section block.
 */
function drawSectionBlock(doc, { title, y, x, width, rows }) {
	doc.setFillColor(...COLORS.white);
	const blockHeight = 12 + rows.length * 10 + 4;
	doc.roundedRect(x, y, width, blockHeight, 2, 2, 'F');

	doc.setDrawColor(...COLORS.slate200);
	doc.setLineWidth(0.2);
	doc.roundedRect(x, y, width, blockHeight, 2, 2, 'S');

	doc.setFillColor(...COLORS.emerald500);
	doc.rect(x, y + 4, 3, 8, 'F');

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(9);
	doc.setTextColor(...COLORS.slate700);
	doc.text(title.toUpperCase(), x + 8, y + 10);

	doc.setDrawColor(...COLORS.slate100);
	doc.setLineWidth(0.2);
	doc.line(x + 4, y + 14, x + width - 4, y + 14);

	let rowY = y + 22;
	const labelWidth = 38;

	rows.forEach((row, index) => {
		if (index > 0 && index < rows.length) {
			doc.setDrawColor(...COLORS.slate100);
			doc.setLineWidth(0.1);
			doc.line(x + 4, rowY - 5, x + width - 4, rowY - 5);
		}

		doc.setFont('helvetica', 'normal');
		doc.setFontSize(7.5);
		doc.setTextColor(...COLORS.slate500);
		doc.text(row.label, x + 6, rowY);

		if (row.badge) {
			const badgeX = x + 6 + labelWidth;
			const textWidth = doc.getTextWidth(row.value);
			doc.setFillColor(...COLORS.emerald100);
			doc.roundedRect(badgeX - 1, rowY - 3.5, textWidth + 4, 5, 1, 1, 'F');
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(7);
			doc.setTextColor(...COLORS.emerald600);
			doc.text(row.value, badgeX + 1, rowY);
		} else if (row.mono) {
			doc.setFont('courier', 'bold');
			doc.setFontSize(8);
			doc.setTextColor(...COLORS.slate900);
			doc.text(row.value, x + 6 + labelWidth, rowY);
		} else {
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8);
			doc.setTextColor(...COLORS.slate900);
			doc.text(row.value, x + 6 + labelWidth, rowY);
		}

		rowY += 10;
	});

	return y + blockHeight;
}

/**
 * Draws the map image with a decorative frame, corner brackets, and attribution text.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance.
 * @param {Object} options
 * @param {string} options.image - Base64 PNG data URL of the map.
 * @param {number} options.x - Left X position in mm.
 * @param {number} options.y - Top Y position in mm.
 * @param {number} options.width - Map width in mm.
 * @param {string[]} [options.wmsAttributions=[]] - WMS attribution strings.
 * @returns {number} The Y position below the map section including attributions.
 */
function drawMapSection(doc, { image, x, y, width, wmsAttributions = [] }) {
	const aspectRatio = 0.85;
	const height = width * aspectRatio;

	doc.setFillColor(...COLORS.slate200);
	doc.roundedRect(x + 1.5, y + 1.5, width, height, 2, 2, 'F');

	doc.setFillColor(...COLORS.white);
	doc.roundedRect(x, y, width, height, 2, 2, 'F');

	doc.addImage(image, 'PNG', x + 2, y + 2, width - 4, height - 4);

	doc.setDrawColor(...COLORS.emerald500);
	doc.setLineWidth(0.8);
	doc.roundedRect(x, y, width, height, 2, 2, 'S');

	doc.setDrawColor(...COLORS.emerald500);
	doc.setLineWidth(1.5);
	doc.line(x, y, x + 6, y);
	doc.line(x, y, x, y + 6);
	doc.line(x + width, y, x + width - 6, y);
	doc.line(x + width, y, x + width, y + 6);
	doc.line(x, y + height, x + 6, y + height);
	doc.line(x, y + height, x, y + height - 6);
	doc.line(x + width, y + height, x + width - 6, y + height);
	doc.line(x + width, y + height, x + width, y + height - 6);

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(5);
	doc.setTextColor(...COLORS.slate400);

	const attributions = ['© OpenMapTiles © OpenStreetMap contributors', ...wmsAttributions];
	const attributionText = attributions.join(' | ');

	const maxWidth = width - 4;
	const lines = doc.splitTextToSize(attributionText, maxWidth);

	let attributionY = y + height + 4;
	for (const line of lines) {
		doc.text(line, x + width / 2, attributionY, { align: 'center' });
		attributionY += 3;
	}

	return y + height + 2 + lines.length * 3;
}

/**
 * Draws a compact coordinate card showing EPSG:25832 and/or EPSG:4326 coordinates.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance.
 * @param {Object} options
 * @param {string} [options.coords25832] - Coordinate string in EPSG:25832.
 * @param {string} [options.coords4326] - Coordinate string in EPSG:4326.
 * @param {number} options.x - Left X position in mm.
 * @param {number} options.y - Top Y position in mm.
 * @param {number} options.width - Card width in mm.
 * @returns {number} The Y position below the card.
 */
function drawCoordinateCard(doc, { coords25832, coords4326, x, y, width }) {
	const cardHeight = coords25832 && coords4326 ? 20 : 12;

	doc.setFillColor(...COLORS.white);
	doc.roundedRect(x, y, width, cardHeight, 2, 2, 'F');

	doc.setDrawColor(...COLORS.slate200);
	doc.setLineWidth(0.2);
	doc.roundedRect(x, y, width, cardHeight, 2, 2, 'S');

	let lineY = y + 7;

	if (coords25832) {
		doc.setFont('courier', 'bold');
		doc.setFontSize(6);
		doc.setTextColor(...COLORS.emerald600);
		doc.text('EPSG:25832', x + 4, lineY);

		doc.setFont('courier', 'normal');
		doc.setFontSize(6.5);
		doc.setTextColor(...COLORS.slate700);
		doc.text(coords25832, x + 26, lineY);

		lineY += 7;
	}

	if (coords4326) {
		doc.setFont('courier', 'bold');
		doc.setFontSize(6);
		doc.setTextColor(...COLORS.emerald600);
		doc.text('EPSG:4326', x + 4, lineY);

		doc.setFont('courier', 'normal');
		doc.setFontSize(6.5);
		doc.setTextColor(...COLORS.slate700);
		doc.text(coords4326, x + 26, lineY);
	}

	return y + cardHeight;
}

/**
 * Draws a table of microduct connections with a header, zebra-striped rows, and color indicators.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance.
 * @param {Object} options
 * @param {Record<string, any>[]} options.microducts - Microduct connection data.
 * @param {number} options.y - Top Y position in mm.
 * @param {Record<string, string>} options.labels - Translation labels for column headers.
 * @returns {number} The Y position below the table.
 */
function drawMicroductTable(doc, { microducts, y, labels }) {
	doc.setFillColor(...COLORS.white);
	doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 12, 2, 2, 'F');

	doc.setFillColor(...COLORS.emerald500);
	doc.rect(MARGIN, y + 4, 3, 8, 'F');

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(9);
	doc.setTextColor(...COLORS.slate700);
	doc.text(labels.sectionMicroductConnections.toUpperCase(), MARGIN + 8, y + 10);

	const countBadgeWidth = 12;
	const countBadgeHeight = 6;
	const countBadgeX = CONTENT_WIDTH + MARGIN - countBadgeWidth - 4;
	const countBadgeY = y + 4;
	doc.setFillColor(...COLORS.emerald100);
	doc.roundedRect(countBadgeX, countBadgeY, countBadgeWidth, countBadgeHeight, 1.5, 1.5, 'F');
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(7);
	doc.setTextColor(...COLORS.emerald600);
	const countText = String(microducts.length);
	doc.text(countText, countBadgeX + countBadgeWidth / 2, countBadgeY + 4.3, { align: 'center' });

	y += 16;

	const headers = [
		labels.tableNode,
		labels.tableConduitName,
		labels.tableConduitType,
		labels.tableNumber,
		labels.tableColor
	];

	const colWidths = [45, 40, 35, 25, 25];
	const rowHeight = 7;

	doc.setFillColor(...COLORS.slate100);
	doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, 'F');

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(6.5);
	doc.setTextColor(...COLORS.slate500);

	let colX = MARGIN + 4;
	headers.forEach((header, i) => {
		doc.text(header.toUpperCase(), colX, y + 5);
		colX += colWidths[i];
	});

	y += rowHeight;

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(7.5);

	microducts.forEach((md, index) => {
		if (index % 2 === 1) {
			doc.setFillColor(...COLORS.slate50);
			doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, 'F');
		}

		colX = MARGIN + 4;

		doc.setTextColor(...COLORS.slate900);
		doc.setFont('helvetica', 'bold');
		doc.text(truncateText(doc, md.nodeName || '–', colWidths[0] - 6), colX, y + 5);
		colX += colWidths[0];

		doc.setFont('helvetica', 'normal');
		doc.text(truncateText(doc, md.conduitName || '–', colWidths[1] - 6), colX, y + 5);
		colX += colWidths[1];

		doc.text(truncateText(doc, md.conduitType || '–', colWidths[2] - 6), colX, y + 5);
		colX += colWidths[2];

		doc.setFont('helvetica', 'normal');
		doc.setTextColor(...COLORS.slate900);
		doc.text(String(md.number || '–'), colX, y + 5);
		colX += colWidths[3];

		const colorHex = md.colorHex || '#64748b';
		const rgb = hexToRgb(colorHex);
		doc.setFillColor(rgb[0], rgb[1], rgb[2]);
		const circleY = y + rowHeight / 2;
		doc.circle(colX + 2, circleY, 1.5, 'F');
		doc.setTextColor(...COLORS.slate900);
		doc.text(md.color || '–', colX + 6, circleY + 1);

		y += rowHeight;
	});

	doc.setDrawColor(...COLORS.slate200);
	doc.setLineWidth(0.2);
	doc.roundedRect(
		MARGIN,
		y - microducts.length * rowHeight - rowHeight,
		CONTENT_WIDTH,
		(microducts.length + 1) * rowHeight,
		2,
		2,
		'S'
	);

	return y;
}

/**
 * Draws a fiber connections table for a residential unit with color-coded bundle/fiber indicators.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance.
 * @param {Object} options
 * @param {Record<string, any>[]} options.fibers - Fiber connection data.
 * @param {number} options.y - Top Y position in mm.
 * @param {Record<string, string>} options.labels - Translation labels for column headers.
 * @returns {number} The Y position below the table.
 */
function drawFiberTable(doc, { fibers, y, labels }) {
	doc.setFillColor(...COLORS.white);
	doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 12, 2, 2, 'F');

	doc.setFillColor(...COLORS.emerald500);
	doc.rect(MARGIN, y + 4, 3, 8, 'F');

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(9);
	doc.setTextColor(...COLORS.slate700);
	doc.text(labels.sectionFiberConnections.toUpperCase(), MARGIN + 8, y + 10);

	const countBadgeWidth = 12;
	const countBadgeHeight = 6;
	const countBadgeX = CONTENT_WIDTH + MARGIN - countBadgeWidth - 4;
	const countBadgeY = y + 4;
	doc.setFillColor(...COLORS.emerald100);
	doc.roundedRect(countBadgeX, countBadgeY, countBadgeWidth, countBadgeHeight, 1.5, 1.5, 'F');
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(7);
	doc.setTextColor(...COLORS.emerald600);
	const countText = String(fibers.length);
	doc.text(countText, countBadgeX + countBadgeWidth / 2, countBadgeY + 4.3, { align: 'center' });

	y += 16;

	const headers = [
		labels.tableNode,
		labels.tableCableName,
		labels.tableFiberAbsolute,
		labels.tableBundle,
		labels.tableFiber
	];

	const colWidths = [40, 40, 30, 30, 30];
	const rowHeight = 7;

	doc.setFillColor(...COLORS.slate100);
	doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, 'F');

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(6.5);
	doc.setTextColor(...COLORS.slate500);

	let colX = MARGIN + 4;
	headers.forEach((header, i) => {
		doc.text(header.toUpperCase(), colX, y + 5);
		colX += colWidths[i];
	});

	y += rowHeight;

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(7.5);

	fibers.forEach((fc, index) => {
		if (index % 2 === 1) {
			doc.setFillColor(...COLORS.slate50);
			doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, 'F');
		}

		colX = MARGIN + 4;

		doc.setTextColor(...COLORS.slate900);
		doc.setFont('helvetica', 'bold');
		doc.text(truncateText(doc, fc.node_name || '–', colWidths[0] - 6), colX, y + 5);
		colX += colWidths[0];

		doc.setFont('helvetica', 'normal');
		doc.text(truncateText(doc, fc.cable_name || '–', colWidths[1] - 6), colX, y + 5);
		colX += colWidths[1];

		doc.setTextColor(...COLORS.slate900);
		doc.text(String(fc.fiber_number_absolute || '–'), colX, y + 5);
		colX += colWidths[2];

		const circleY = y + rowHeight / 2;

		const bundleColorHex = fc.bundle_color_hex || '#999999';
		const bundleRgb = hexToRgb(bundleColorHex);
		doc.setFillColor(bundleRgb[0], bundleRgb[1], bundleRgb[2]);
		doc.circle(colX + 2, circleY, 1.5, 'F');
		doc.setTextColor(...COLORS.slate900);
		doc.text(`${fc.bundle_number || '–'}`, colX + 6, circleY + 1);
		colX += colWidths[3];

		const fiberColorHex = fc.fiber_color_hex || '#999999';
		const fiberRgb = hexToRgb(fiberColorHex);
		doc.setFillColor(fiberRgb[0], fiberRgb[1], fiberRgb[2]);
		doc.circle(colX + 2, circleY, 1.5, 'F');
		doc.setTextColor(...COLORS.slate900);
		doc.text(`${fc.fiber_number || '–'}`, colX + 6, circleY + 1);

		y += rowHeight;
	});

	doc.setDrawColor(...COLORS.slate200);
	doc.setLineWidth(0.2);
	doc.roundedRect(
		MARGIN,
		y - fibers.length * rowHeight - rowHeight,
		CONTENT_WIDTH,
		(fibers.length + 1) * rowHeight,
		2,
		2,
		'S'
	);

	return y;
}

/**
 * Truncates text with an ellipsis to fit within a given pixel width.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance (used for width measurement).
 * @param {string} text - The text to truncate.
 * @param {number} maxWidth - Maximum allowed text width in mm.
 * @returns {string} The (possibly truncated) text.
 */
function truncateText(doc, text, maxWidth) {
	if (doc.getTextWidth(text) <= maxWidth) return text;
	let truncated = text;
	while (doc.getTextWidth(truncated + '…') > maxWidth && truncated.length > 0) {
		truncated = truncated.slice(0, -1);
	}
	return truncated + '…';
}

/**
 * Converts a hex color string to an RGB tuple. Falls back to slate-500 on invalid input.
 * @param {string} hex - Hex color string (e.g., '#ff0000' or 'ff0000').
 * @returns {[number, number, number]} RGB values as a 3-element array.
 */
function hexToRgb(hex) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
		: [100, 116, 139];
}

/**
 * Adds page numbers, brand text, and a footer separator to every page in the document.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance.
 */
function addPageNumbers(doc) {
	const totalPages = doc.getNumberOfPages();

	for (let i = 1; i <= totalPages; i++) {
		doc.setPage(i);

		doc.setFillColor(...COLORS.white);
		doc.rect(0, PAGE_HEIGHT - 16, PAGE_WIDTH, 16, 'F');

		doc.setDrawColor(...COLORS.slate200);
		doc.setLineWidth(0.3);
		doc.line(MARGIN, PAGE_HEIGHT - 16, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 16);

		doc.setFont('helvetica', 'bold');
		doc.setFontSize(7);
		doc.setTextColor(...COLORS.emerald600);
		doc.text(m.Qonnectra(), MARGIN, PAGE_HEIGHT - 8);

		const qWidth = doc.getTextWidth(m.Qonnectra());
		doc.setFont('helvetica', 'normal');
		doc.setTextColor(...COLORS.slate400);

		doc.setFont('helvetica', 'normal');
		doc.setFontSize(7);
		doc.setTextColor(...COLORS.slate400);

		const pageText = `${i} / ${totalPages}`;
		doc.text(pageText, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: 'right' });

		const centerText = m.common_documentation();
		doc.setTextColor(...COLORS.slate400);
		doc.text(centerText, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' });
	}
}
