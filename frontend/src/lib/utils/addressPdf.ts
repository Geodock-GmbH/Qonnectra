import type { jsPDF } from 'jspdf';
import { jsPDF as JsPDF } from 'jspdf';

import { m } from '$lib/paraglide/messages';

interface AddressData {
	street: string;
	housenumber: string;
	house_number_suffix?: string;
	zip_code: string;
	city: string;
	district?: string;
	id_address?: string;
	status_development?: { status: string };
	flag?: { flag: string };
	project?: { project: string };
	coordsDefault?: string;
	coords4326?: string;
	srid?: number;
	[key: string]: unknown;
}

interface ResidentialUnit {
	id_residential_unit?: string;
	external_id_1?: string;
	external_id_2?: string;
	residential_unit_type?: { residential_unit_type: string };
	status?: { status: string };
	floor?: number | string;
	side?: string;
	building_section?: string;
	resident_name?: string;
	resident_recorded_date?: string;
	ready_for_service?: string;
	fiberConnections?: FiberConnection[];
	[key: string]: unknown;
}

interface MicroductData {
	parentNodeName?: string;
	nodeName?: string;
	conduitName?: string;
	conduitType?: string;
	number?: number | string;
	colorHex?: string;
	color?: string;
	[key: string]: unknown;
}

interface FiberConnection {
	parent_node_name?: string;
	node_name?: string;
	cable_name?: string;
	fiber_number_absolute?: number | string;
	bundle_color_hex?: string;
	bundle_number?: number | string;
	fiber_color_hex?: string;
	fiber_number?: number | string;
	[key: string]: unknown;
}

interface PdfLabels {
	sectionAddressInformation: string;
	idAddress: string;
	street: string;
	housenumber: string;
	zipCode: string;
	city: string;
	district: string;
	sectionClassification: string;
	statusDevelopment: string;
	flag: string;
	project: string;
	sectionMicroductConnections: string;
	tableParentNode: string;
	tableNode: string;
	tableConduitName: string;
	tableConduitType: string;
	tableNumber: string;
	tableColor: string;
	residentialUnit: string;
	sectionIdentification: string;
	unitId: string;
	externalId1: string;
	externalId2: string;
	unitType: string;
	unitStatus: string;
	sectionUnitLocation: string;
	floor: string;
	side: string;
	buildingSection: string;
	sectionResident: string;
	residentName: string;
	residentRecordedDate: string;
	readyForService: string;
	sectionFiberConnections: string;
	tableCableName: string;
	tableFiberAbsolute: string;
	tableBundle: string;
	tableFiber: string;
	sectionComment?: string;
	[key: string]: string | undefined;
}

interface SectionRow {
	label: string;
	value: string;
	badge?: boolean;
	mono?: boolean;
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

const COLORS: Record<string, [number, number, number]> = {
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

/** Generates and downloads a PDF document for an address, optionally including residential unit pages. */
export function generateAddressPdf({
	address,
	residentialUnits,
	mapImage,
	includeResidentialUnits,
	linkedMicroducts = [],
	wmsAttributions = [],
	labels,
	commentText = ''
}: {
	address: AddressData;
	residentialUnits: ResidentialUnit[];
	mapImage: string | null;
	includeResidentialUnits: boolean;
	linkedMicroducts?: MicroductData[];
	wmsAttributions?: string[];
	labels: PdfLabels;
	commentText?: string;
}): void {
	const doc = new JsPDF('p', 'mm', 'a4');

	buildAddressPage(doc, {
		address,
		mapImage,
		linkedMicroducts,
		wmsAttributions,
		labels,
		commentText
	});

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

/** Builds the address overview page with map, data sections, and optional microduct table. */
function buildAddressPage(
	doc: jsPDF,
	{
		address,
		mapImage,
		linkedMicroducts,
		wmsAttributions = [],
		labels,
		commentText = ''
	}: {
		address: AddressData;
		mapImage: string | null;
		linkedMicroducts: MicroductData[];
		wmsAttributions?: string[];
		labels: PdfLabels;
		commentText?: string;
	}
) {
	drawPageBackground(doc);

	let y = drawDocumentHeader(doc, {
		title: `${address.street} ${address.housenumber}${address.house_number_suffix || ''}`,
		subtitle: `${address.zip_code} ${address.city}${address.district ? ` · ${address.district}` : ''}`
	});

	y += 8;

	const hasMap = !!mapImage;
	const mapColWidth = hasMap ? 78 : 0;
	const dataColWidth = hasMap ? CONTENT_WIDTH - mapColWidth - 12 : CONTENT_WIDTH;
	const mapX = hasMap ? MARGIN + dataColWidth + 12 : 0;

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

	if (address.coordsDefault || address.coords4326) {
		mapY = drawCoordinateCard(doc, {
			coordsDefault: address.coordsDefault,
			coords4326: address.coords4326,
			srid: address.srid,
			x: mapX,
			y: mapY,
			width: mapColWidth
		});
	}

	const bottomY = Math.max(dataY, mapY) + 10;

	let currentY = bottomY;

	if (linkedMicroducts?.length > 0) {
		currentY = drawMicroductTable(doc, {
			microducts: linkedMicroducts,
			y: currentY,
			labels
		});
		currentY += 10;
	}

	if (commentText) {
		const commentHeight = measureCommentBlock(doc, commentText, CONTENT_WIDTH);
		const maxY = PAGE_HEIGHT - 16;

		if (currentY + commentHeight > maxY) {
			doc.addPage();
			drawPageBackground(doc);
			currentY = drawDocumentHeader(doc, {
				title: labels.sectionComment || 'Comment',
				subtitle: `${address.street} ${address.housenumber}${address.house_number_suffix || ''}`
			});
			currentY += 8;
		}

		drawCommentBlock(doc, {
			title: labels.sectionComment || 'Comment',
			y: currentY,
			x: MARGIN,
			width: CONTENT_WIDTH,
			text: commentText
		});
	}
}

/** Builds a residential unit detail page with identification, classification, and fiber data. */
function buildResidentialUnitPage(
	doc: jsPDF,
	{
		unit,
		address,
		labels
	}: {
		unit: ResidentialUnit;
		address: AddressData;
		labels: PdfLabels;
	}
) {
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

	const fibers = unit.fiberConnections;
	if (fibers && fibers.length > 0) {
		drawFiberTable(doc, {
			fibers,
			y: bottomY,
			labels
		});
	}
}

/** Draws the page background with an emerald side stripe. */
function drawPageBackground(doc: jsPDF) {
	doc.setFillColor(...COLORS.white);
	doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

	doc.setFillColor(...COLORS.emerald500);
	doc.rect(0, 0, 4, PAGE_HEIGHT, 'F');

	doc.setFillColor(...COLORS.emerald600);
	doc.rect(0, 0, 1.5, PAGE_HEIGHT, 'F');
}

/** Draws the document header with brand, title, subtitle, and a separator line. */
function drawDocumentHeader(
	doc: jsPDF,
	{ title, subtitle }: { title: string; subtitle: string }
): number {
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

/** Draws a bordered section block with a colored accent, title, and labeled data rows. */
function drawSectionBlock(
	doc: jsPDF,
	{
		title,
		y,
		x,
		width,
		rows
	}: {
		title: string;
		icon?: string;
		y: number;
		x: number;
		width: number;
		rows: SectionRow[];
	}
): number {
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

/** Draws the map image with a decorative frame, corner brackets, and attribution text. */
function drawMapSection(
	doc: jsPDF,
	{
		image,
		x,
		y,
		width,
		wmsAttributions = []
	}: {
		image: string;
		x: number;
		y: number;
		width: number;
		wmsAttributions?: string[];
	}
): number {
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

/** Draws a compact coordinate card showing storage SRID and/or EPSG:4326 coordinates. */
function drawCoordinateCard(
	doc: jsPDF,
	{
		coordsDefault,
		coords4326,
		srid,
		x,
		y,
		width
	}: {
		coordsDefault?: string;
		coords4326?: string;
		srid?: number;
		x: number;
		y: number;
		width: number;
	}
): number {
	const cardHeight = coordsDefault && coords4326 ? 20 : 12;

	doc.setFillColor(...COLORS.white);
	doc.roundedRect(x, y, width, cardHeight, 2, 2, 'F');

	doc.setDrawColor(...COLORS.slate200);
	doc.setLineWidth(0.2);
	doc.roundedRect(x, y, width, cardHeight, 2, 2, 'S');

	let lineY = y + 7;

	if (coordsDefault) {
		doc.setFont('courier', 'bold');
		doc.setFontSize(6);
		doc.setTextColor(...COLORS.emerald600);
		doc.text(`EPSG:${srid}`, x + 4, lineY);

		doc.setFont('courier', 'normal');
		doc.setFontSize(6.5);
		doc.setTextColor(...COLORS.slate700);
		doc.text(coordsDefault, x + 26, lineY);

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

/** Draws a table of microduct connections with a header, zebra-striped rows, and color indicators. */
function drawMicroductTable(
	doc: jsPDF,
	{
		microducts,
		y,
		labels
	}: {
		microducts: MicroductData[];
		y: number;
		labels: PdfLabels;
	}
): number {
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
		labels.tableParentNode,
		labels.tableNode,
		labels.tableConduitName,
		labels.tableConduitType,
		labels.tableNumber,
		labels.tableColor
	];

	const colWidths = [35, 35, 30, 30, 20, 20];
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
		doc.text(truncateText(doc, md.parentNodeName || '–', colWidths[0] - 6), colX, y + 5);
		colX += colWidths[0];

		doc.setFont('helvetica', 'normal');
		doc.text(truncateText(doc, md.nodeName || '–', colWidths[1] - 6), colX, y + 5);
		colX += colWidths[1];

		doc.text(truncateText(doc, md.conduitName || '–', colWidths[2] - 6), colX, y + 5);
		colX += colWidths[2];

		doc.text(truncateText(doc, md.conduitType || '–', colWidths[3] - 6), colX, y + 5);
		colX += colWidths[3];

		doc.setFont('helvetica', 'normal');
		doc.setTextColor(...COLORS.slate900);
		doc.text(String(md.number || '–'), colX, y + 5);
		colX += colWidths[4];

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

/** Draws a fiber connections table for a residential unit with color-coded bundle/fiber indicators. */
function drawFiberTable(
	doc: jsPDF,
	{
		fibers,
		y,
		labels
	}: {
		fibers: FiberConnection[];
		y: number;
		labels: PdfLabels;
	}
): number {
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
		labels.tableParentNode,
		labels.tableNode,
		labels.tableCableName,
		labels.tableFiberAbsolute,
		labels.tableBundle,
		labels.tableFiber
	];

	const colWidths = [30, 30, 30, 25, 27, 28];
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
		doc.text(truncateText(doc, fc.parent_node_name || '–', colWidths[0] - 6), colX, y + 5);
		colX += colWidths[0];

		doc.setFont('helvetica', 'normal');
		doc.text(truncateText(doc, fc.node_name || '–', colWidths[1] - 6), colX, y + 5);
		colX += colWidths[1];

		doc.text(truncateText(doc, fc.cable_name || '–', colWidths[2] - 6), colX, y + 5);
		colX += colWidths[2];

		doc.setTextColor(...COLORS.slate900);
		doc.text(String(fc.fiber_number_absolute || '–'), colX, y + 5);
		colX += colWidths[3];

		const circleY = y + rowHeight / 2;

		const bundleColorHex = fc.bundle_color_hex || '#999999';
		const bundleRgb = hexToRgb(bundleColorHex);
		doc.setFillColor(bundleRgb[0], bundleRgb[1], bundleRgb[2]);
		doc.circle(colX + 2, circleY, 1.5, 'F');
		doc.setTextColor(...COLORS.slate900);
		doc.text(`${fc.bundle_number || '–'}`, colX + 6, circleY + 1);
		colX += colWidths[4];

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

/** Measures the height a comment block would occupy without drawing it. */
function measureCommentBlock(doc: jsPDF, text: string, width: number): number {
	const textWidth = width - 16;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(8);
	const lines = doc.splitTextToSize(text, textWidth);
	return 16 + lines.length * 4.5 + 6;
}

/** Draws a section block with wrapped free-text content (e.g., comment/description). */
function drawCommentBlock(
	doc: jsPDF,
	{
		title,
		y,
		x,
		width,
		text
	}: {
		title: string;
		y: number;
		x: number;
		width: number;
		text: string;
	}
): number {
	const textWidth = width - 16;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(8);
	const lines = doc.splitTextToSize(text, textWidth);
	const lineHeight = 4.5;
	const blockHeight = 16 + lines.length * lineHeight + 6;

	doc.setFillColor(...COLORS.white);
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

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(8);
	doc.setTextColor(...COLORS.slate900);

	let lineY = y + 22;
	for (const line of lines) {
		doc.text(line, x + 8, lineY);
		lineY += lineHeight;
	}

	return y + blockHeight;
}

/** Truncates text with an ellipsis to fit within a given pixel width. */
function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
	if (doc.getTextWidth(text) <= maxWidth) return text;
	let truncated = text;
	while (doc.getTextWidth(truncated + '…') > maxWidth && truncated.length > 0) {
		truncated = truncated.slice(0, -1);
	}
	return truncated + '…';
}

/** Converts a hex color string to an RGB tuple. Falls back to slate-500 on invalid input. */
function hexToRgb(hex: string): [number, number, number] {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
		: [100, 116, 139];
}

/** Adds page numbers, brand text, and a footer separator to every page in the document. */
function addPageNumbers(doc: jsPDF) {
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
