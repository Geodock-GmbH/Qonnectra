/**
 * Friendly type aliases for the core domain models, re-exported from the
 * generated OpenAPI types in `./api.d.ts`.
 *
 * Import these instead of reaching into `components['schemas'][...]` directly:
 *
 * ```ts
 * import type { Trench, Conduit } from '$lib/types';
 * ```
 *
 * `api.d.ts` is generated from the backend schema (`npm run generate:types`) —
 * do not hand-edit it. Add new aliases here, not there.
 */
import type { components } from './api';

export type Schemas = components['schemas'];

export type Address = Schemas['Address'];
export type Cable = Schemas['Cable'];
export type ComponentStructure = Schemas['AttributesComponentStructure'];
export type ComponentType = Schemas['AttributesComponentType'];
export type Conduit = Schemas['Conduit'];
export type Container = Schemas['Container'];
export type ContainerType = Schemas['ContainerType'];
export type Fiber = Schemas['Fiber'];
export type FiberSplice = Schemas['FiberSplice'];
export type Microduct = Schemas['Microduct'];
export type Node = Schemas['Node'];
export type ResidentialUnit = Schemas['ResidentialUnit'];
export type ResidentialUnitType = Schemas['AttributesResidentialUnitType'];
export type ResidentialUnitStatus = Schemas['AttributesResidentialUnitStatus'];
export type Trench = Schemas['Trench'];

/**
 * Nested "trenches near node" payload (trench → conduits → microducts), as used
 * by the pipe-branch view. Distinct from the flat {@link Trench} feature.
 */
export type TrenchesNearNodeTrench = Schemas['TrenchesNearNodeTrench'];
export type TrenchesNearNodeConduit = Schemas['TrenchesNearNodeConduit'];
export type TrenchesNearNodeMicroduct = Schemas['TrenchesNearNodeMicroduct'];
