import type {MereseEngine} from './mereseQueryEngine';
export type AssistantContext={region?:string;size?:string;reserveData?:import("./reserveAnalytics").ReserveContextData;reserva?:string;anioRegulatorio?:string;scopeCodes?:string[];ods?:string;codEp?:string;eps?:string;desde?:string;hasta?:string;descripcion?:string;anio?:number;codigo?:string};
export const getAssistantContext=(context:AssistantContext):AssistantContext=>({...context});
export type LocalQuery={method:Exclude<keyof MereseEngine,'obtenerRangoPeriodo'>;params:Record<string,unknown>};
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const unsupported='Esta consulta estará disponible cuando se conecte el motor de IA. Por ahora puedes utilizar las preguntas sugeridas.';
export function parseLocalMereseQuery(text:string,c:AssistantContext):LocalQuery{
 const t=normalize(text).trim();
 const base={desde:c.desde,hasta:c.hasta};
 if(/^(resume|resumen de) esta eps[?.!]?$/.test(t)){if(!c.codEp)throw Error('Selecciona una EPS para consultar su resumen.');return {method:'consultarEPS',params:{...base,codEp:c.codEp}}}
 if(/^(resume|resumen de) esta ods[?.!]?$/.test(t)){if(!c.ods)throw Error('Selecciona una ODS para consultar su resumen.');return {method:'consultarODS',params:{...base,ods:c.ods}}}
 if(/^(muestrame las )?intervenciones de esta eps[?.!]?$/.test(t)){if(!c.codEp)throw Error('Selecciona una EPS.');return {method:'listarIntervenciones',params:{codEp:c.codEp,descripcion:c.descripcion,anio:c.anio,codigo:c.codigo}}}
 const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
 const between=t.match(/entre (\w+) (?:de )?(\d{4}) y (\w+) (?:de )?(\d{4})/);
 if(between&&/^dame las eps que han ejecutado entre /.test(t)&&/^(,? ordenadas de mayor a menor[.!]?)?$/.test(t.slice(t.indexOf(between[0])+between[0].length))){const a=months.indexOf(between[1]),b=months.indexOf(between[3]);if(a<0||b<0)throw Error('Utiliza nombres completos de meses.');return {method:'listarEjecucionEPS',params:{desde:between[2]+'-'+String(a+1).padStart(2,'0'),hasta:between[4]+'-'+String(b+1).padStart(2,'0'),soloConEjecucion:true,orden:'desc'}}}
 const rank=t.match(/^(?:dame las (?:(\d+) )?)?eps con mayor (ejecucion|saldo)[.!]?$/);
 if(rank)return {method:rank[2]==='saldo'?'listarSaldosEPS':'listarEjecucionEPS',params:{...base,orden:'desc',limite:rank[1]?Number(rank[1]):10,...(rank[2]==='ejecucion'?{soloConEjecucion:true}:{})}};
 const amount=t.match(/^(?:dame las )?eps con saldo mayor a (?:s\/\s*)?(\d+(?:\.\d+)?)\s*(millon|millones|mil)?[.!]?$/);
 if(amount){const threshold=Number(amount[1])*(amount[2]==='mil'?1000:amount[2]?1000000:1);return {method:'listarSaldosEPS',params:{hasta:c.hasta,saldoMinimo:threshold,orden:'desc',estrictoMayor:threshold}}}
 throw Error(unsupported);
}
export function executeLocalQuery(engine:MereseEngine,q:LocalQuery){const {estrictoMayor,...params}=q.params;const fn=engine[q.method] as (p:any)=>ReturnType<MereseEngine['consultarEPS']>;const r=fn(params);if(typeof estrictoMayor==='number'){r.rows=r.rows.filter(row=>typeof row.SALDO==='number'&&row.SALDO>estrictoMayor);r.metadata.totalRegistros=r.rows.length;r.summary=`${r.rows.length} registro(s) encontrados.`}return r;}
