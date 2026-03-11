import { jsPDF } from 'jspdf';

import { m } from '$lib/paraglide/messages';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

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
 * Generate a PDF for an address with optional residential units.
 * @param {Object} params
 * @param {Object} params.address - Address data object
 * @param {Array} params.residentialUnits - Array of residential unit objects
 * @param {string|null} params.mapImage - Base64 data URL of the map canvas
 * @param {boolean} params.includeResidentialUnits - Whether to include RU pages
 * @param {Object} params.labels - Translation labels
 */
export function generateAddressPdf({
	address,
	residentialUnits,
	mapImage,
	includeResidentialUnits,
	labels
}) {
	const doc = new jsPDF('p', 'mm', 'a4');

	buildAddressPage(doc, { address, mapImage, labels });

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
 * Build the address overview page with editorial cartographic design.
 */
function buildAddressPage(doc, { address, mapImage, labels }) {
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
			width: mapColWidth
		});
		mapY += 6;
	}

	if (address.coords25832 || address.coords4326) {
		drawCoordinateCard(doc, {
			coords25832: address.coords25832,
			coords4326: address.coords4326,
			x: mapX,
			y: mapY,
			width: mapColWidth
		});
	}
}

/**
 * Build a residential unit page.
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

	drawSectionBlock(doc, {
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

	drawSectionBlock(doc, {
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
}

/**
 * Draw page background with emerald side stripe.
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
 * Draw the document header with typographic hierarchy.
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
 * Draw a section block with icon, title, and data rows.
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
 * Draw the map section with frame and shadow effect.
 */
function drawMapSection(doc, { image, x, y, width }) {
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

	return y + height;
}

/**
 * Draw coordinate card below the map.
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
 * Add page numbers and footer with refined styling.
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
