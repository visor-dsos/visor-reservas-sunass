import type {Institution,QueryResult,MereseEngine} from '../../mereseQueryEngine';
import type {AssistantContext} from '../../parseLocalMereseQuery';
import type {Finance} from '../../interventionIndicators';
export type Metric='EJECUCION_MERESE'|'SALDO'|'AREA_HA'|'LONGITUD_KM'|'INTERVENCIONES';
export type Condition={metric:Metric;op:'gt'|'gte'|'lt'|'lte'|'eq';value:number};
export type Period={desde?:string;hasta?:string};
export type Plan={advanced?:{kind:'pr'|'extremes';firstNYears?:number;regulatoryYear?:number;compare?:boolean;metric:string};intent:string;level:'eps'|'ods'|'national'|'interventions';codes:string[];ods:string[];period:Period;balanceUntil?:string;latestBalance:boolean;conditions:Condition[];metric:Metric;sort:'asc'|'desc';limit?:number;positiveExecution:boolean;physical:{anio?:number;tipoIntervencion?:string;descripcion?:string;relacionCuenca?:string;codigo?:string};summary:boolean;count:boolean;range:boolean;followUp:boolean;output:'table'|'xlsx'|'csv'|'chart';confidence:number;original:string};
export type ConversationState={region?:string;size?:string;analyticMetric?:string;analyticSituation?:string;reserve?:string;reserveComparisonCodes?:string[];regulatoryCodes?:string[];lastRegulatoryYear?:number;lastResultOds?:string[];lastRows?:QueryResult['rows'];selectedColumns?:string[];lastComparison?:QueryResult;exclusions?:{excludeOds:string[];excludeCodEps:string[]};lastAggregation?:QueryResult;lastRegulatoryMetric?:string;lastRegulatoryEps?:string[];lastIntent?:string;lastQueryPlan?:Plan;lastResultCodEps?:string[];lastOds?:string[];lastPeriod?:Period;lastSort?:string;lastLimit?:number;lastMetric?:Metric;lastResult?:QueryResult};
export type Environment={engine:MereseEngine;institutions:Institution[];context:AssistantContext;state:ConversationState;finances?:Record<string,Finance>};
export class Clarification extends Error {constructor(message:string){super(message);this.name='Clarification';}}
