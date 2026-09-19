import type { SignalAnalysisResult, TraceResult } from '$lib/types/trace';
import { query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import {
	fiberTracePath,
	GEOMETRY_MODES,
	signalAnalysisPath,
	TRACE_ENTRY_TYPES
} from './trace-data';

const UuidSchema = v.pipe(v.string(), v.nonEmpty());

const FiberTraceSchema = v.object({
	entryType: v.picklist(TRACE_ENTRY_TYPES),
	entryId: UuidSchema,
	includeGeometry: v.boolean(),
	geometryMode: v.picklist(GEOMETRY_MODES),
	orientGeometry: v.boolean()
});

const SignalAnalysisSchema = v.object({
	fiberId: UuidSchema,
	signalSource: v.nullable(UuidSchema),
	orientGeometry: v.boolean()
});

/**
 * Trace the fiber paths that run through an entity.
 * @param input.entryType - Kind of entity the trace starts from.
 * @param input.entryId - UUID of that entity.
 * @param input.includeGeometry - Whether trench and node geometries are returned.
 * @param input.geometryMode - How trench geometry is shaped; ignored without geometry.
 * @param input.orientGeometry - Whether lines are oriented along the fiber; ignored without geometry.
 * @returns The trace trees, cable infrastructure and statistics.
 * @throws When the entity is unknown or the backend request fails.
 */
export const getFiberTrace = query(FiberTraceSchema, async (input): Promise<TraceResult> => {
	const response = await fetch(`${API_URL}${fiberTracePath(input)}`, {
		headers: djangoHeaders()
	});
	if (!response.ok) await failFromResponse(response, 'Trace failed');

	return (await response.json()) as TraceResult;
});

/**
 * Analyse how far a signal reaches along a fiber, always with routed geometry.
 * @param input.fiberId - UUID of the fiber.
 * @param input.signalSource - Node the signal is fed in at; `null` uses the backend's default.
 * @param input.orientGeometry - Whether lines are oriented along the fiber.
 * @returns The trace with signal states, break points and the affected summary.
 * @throws When the fiber is unknown or the backend request fails.
 */
export const getSignalAnalysis = query(
	SignalAnalysisSchema,
	async (input): Promise<SignalAnalysisResult> => {
		const response = await fetch(`${API_URL}${signalAnalysisPath(input)}`, {
			headers: djangoHeaders()
		});
		if (!response.ok) await failFromResponse(response, 'Signal analysis failed');

		return (await response.json()) as SignalAnalysisResult;
	}
);
