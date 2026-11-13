import {reserveEnvironment,reservesQuery} from './reservesQuery';
import {advancedQuery} from './advancedQuery';
import {analytics} from './analytics';
import {regulatoryQuery} from './regulatoryQuery';
import {normalizeText} from './normalizeText';
import {extract} from './slotExtractor';
import {executePlan} from './queryPlanner';
import {remember} from './conversationState';
import {Clarification,type Environment} from './types';
export {Clarification};
function parseSelected(text:string,e:Environment):{result:import('../../mereseQueryEngine').QueryResult;plan?:import('./types').Plan;action:'table'|'csv'|'xlsx'|'chart'}{
 if(!text.trim()||text.length>2000)throw new Clarification('Escribe una consulta de hasta 2000 caracteres.');
 let normalized=normalizeText(text);
 if(/prioriz|asistencia tecnica|\bat\b/.test(normalized))throw new Clarification('Esta consulta no forma parte de este visor de reservas.');
 if(/\b(borra|elimina|modifica|publica|word|cambia el mapa)\b/.test(normalized))throw new Clarification('Agente Crash solo consulta datos y exporta resultados a Excel, CSV o grÃ¡ficos.');
 if(/\b(descarga|descargalo|exporta|quiero el excel|quiero el csv)/.test(normalized)){
  if(e.context.reserva&&/prioriz|alerta|pequena|mediana|conexion/.test(normalized)){const q=parseSelected(normalized.replace(/^(descarga|exporta)\s*/,''),e);return {...q,action:/csv/.test(normalized)?'csv' as const:'xlsx' as const};}
  if(!e.state.lastResult)throw new Clarification('Primero realiza la consulta que deseas descargar.');
  return {result:e.state.lastResult,action:/csv/.test(normalized)?'csv' as const:'xlsx' as const};
 }
 if(!e.context.reserveData&&/^(?:cual es )?(?:su |la )?ejecucion$/.test(normalized))throw new Clarification('Â¿Deseas la ejecuciÃ³n MERESE en soles o el porcentaje respecto a la Meta de GestiÃ³n?');
 e=reserveEnvironment(normalized,e);
 if(e.context.reserva)normalized=normalized.replace(/\bgrd(?:\s+y\s+acc)?\b|\bacc\b|\bmerese\b/g,'').replace(/\s+/g,' ').trim();
 const reserve=reservesQuery(normalized,e);
 if(reserve){remember(e.state,reserve.plan,reserve.result);return {...reserve,action:'table' as const};}
 if(e.context.reserva){const analytical=analytics(normalized,e);if(analytical){remember(e.state,analytical.plan,analytical.result);return {...analytical,action:'table' as const};}}
 const advanced=advancedQuery(normalized,e);
 if(advanced){remember(e.state,advanced.plan,advanced.result);return {...advanced,action:'table' as const};}
 const regulatory=regulatoryQuery(normalized,e);
 if(regulatory){remember(e.state,regulatory.plan,regulatory.result);return {...regulatory,action:'table' as const};}
 const analytical=analytics(normalized,e);
 if(analytical){remember(e.state,analytical.plan,analytical.result);return {...analytical,action:'table' as const};}
 const plan=extract(normalized,text,e);
 if(plan.output==='chart'){
  if(!e.state.lastResult?.chart)throw new Clarification('Primero consulta un ranking o una comparaciÃ³n con valores para graficar.');
  const result=plan.limit?{...e.state.lastResult,rows:e.state.lastResult.rows.slice(0,plan.limit)}:e.state.lastResult;
  return {result,action:'chart' as const,plan};
 }
 const result=executePlan(plan,e);remember(e.state,plan,result);return {result,action:'table' as const,plan};
}

// Keep internal query keys compatible; label only the selected reserve's public result.
export function parseMerese(text:string,e:Environment){
 const r=parseSelected(text,e);
 const explicit=/\bgrd\b|\bacc\b/i.test(text)?'GRD_ACC':/\bmerese\b/i.test(text)?'MERESE':e.context.reserva;
 if(!e.context.reserva||explicit!=='GRD_ACC'||r.result.title==='Indicador territorial'&&r.result.rows.some(row=>row.MENSAJE))return r;
 const label=(s:string)=>s.replaceAll('EJECUCION_MERESE','EJECUCION_GRD_ACC').replaceAll('MERESE','GRD y ACC').replaceAll('Q:U','AF:AJ').replaceAll('G:K','V:Z');
 const result={...r.result,title:label(r.result.title),description:label(r.result.description),summary:label(r.result.summary),columns:r.result.columns.map(label),rows:r.result.rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[label(k),typeof v==='string'?label(v):v]))),chart:r.result.chart?label(r.result.chart):undefined,metadata:{...r.result.metadata,reserva:'GRD y ACC'}};
 return {...r,result};
}
