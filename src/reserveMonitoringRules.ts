export type ReserveRule={id:string;label:string;enabled:boolean;metric:string;operator:'gt'|'lt'|'eq';threshold:number;severity:'green'|'yellow'|'red'};
// No qualitative thresholds approved. This list is intentionally empty.
export const reserveMonitoringRules:ReserveRule[]=[];
// Rounding consistency only, in percentage points; not a performance threshold.
export const metaConsistencyTolerancePP=0.1;
