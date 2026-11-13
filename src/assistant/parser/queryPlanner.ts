import type {Cell,QueryResult,MereseEngine} from '../../mereseQueryEngine';
import type {Environment,Plan,Condition} from './types';
type Row=Record<string,Cell>;
const caches=new WeakMap<MereseEngine,Map<string,unknown>>();
function call<K extends keyof MereseEngine>(e:MereseEngine,name:K,params:Parameters<MereseEngine[K]>[0]):ReturnType<MereseEngine[K]>{let cache=caches.get(e);if(!cache){cache=new Map();caches.set(e,cache);}const key=name+JSON.stringify(params);if(!cache.has(key)){if(cache.size>=150)cache.delete(cache.keys().next().value!);cache.set(key,(e[name] as (p:unknown)=>unknown)(params));}return cache.get(key) as ReturnType<MereseEngine[K]>;}
const meets=(row:Row,c:Condition)=>{const v=row[c.metric];return typeof v==='number'&&(c.op==='gt'?v>c.value:c.op==='gte'?v>=c.value:c.op==='lt'?v<c.value:c.op==='lte'?v<=c.value:v===c.value);};
const sum=(rows:Row[],column:string)=>{const valid=rows.map(r=>r[column]).filter((v):v is number=>typeof v==='number');return valid.length?valid.reduce((a,b)=>a+b,0):null;};
export function executePlan(p:Plan,e:Environment):QueryResult{
 const inst=e.institutions.filter(i=>(!e.context.scopeCodes||e.context.scopeCodes.includes(i.COD_EP))&&(!p.codes.length||p.codes.includes(i.COD_EP))&&(!p.ods.length||p.ods.includes(i.ODS)));
 const rangeScope=p.codes.length===1?{codEp:p.codes[0]}:p.ods.length===1?{ods:p.ods[0]}:{};
 const available=call(e.engine,'obtenerRangoPeriodo',rangeScope);
 const period={desde:p.period.desde??available.desde,hasta:p.period.hasta??available.hasta};
 const balanceUntil=p.latestBalance?available.hasta:p.balanceUntil??period.hasta;
 let rows:Row[]=[],columns:string[]=[];
 if(p.range){rows=[{DESDE:available.desde??null,HASTA:available.hasta??null}];}
 else if(p.level==='interventions'){
  rows=call(e.engine,'listarIntervenciones',p.physical).rows.filter(r=>inst.some(i=>i.COD_EP===r.COD_EP));
  if(p.period.desde)rows=rows.filter(r=>Number(r.AÑO)>=Number(p.period.desde!.slice(0,4)));if(p.period.hasta)rows=rows.filter(r=>Number(r.AÑO)<=Number(p.period.hasta!.slice(0,4)));
  columns=call(e.engine,'listarIntervenciones',p.physical).columns;
 }else if(p.level==='ods'){
  rows=[...new Set(inst.map(i=>i.ODS))].map(ods=>call(e.engine,'consultarODS',{ods,...period}).rows[0]);
  if(p.latestBalance)rows=rows.map(r=>({...r,SALDO:call(e.engine,'consultarODS',{ods:String(r.ODS),hasta:balanceUntil}).rows[0].SALDO}));
 }else{
  const needPhysical=p.summary||['AREA_HA','LONGITUD_KM','INTERVENCIONES'].includes(p.metric)||p.conditions.some(c=>['AREA_HA','LONGITUD_KM','INTERVENCIONES'].includes(c.metric));
  const exec=call(e.engine,'listarEjecucionEPS',period).rows,saldo=call(e.engine,'listarSaldosEPS',{hasta:balanceUntil}).rows;
  const em=new Map(exec.map(r=>[r.COD_EP,r])),sm=new Map(saldo.map(r=>[r.COD_EP,r]));
  rows=inst.map(i=>({...em.get(i.COD_EP),...sm.get(i.COD_EP),...(p.summary?call(e.engine,'consultarEPS',{codEp:i.COD_EP,...period}).rows[0]:{}),...(needPhysical?call(e.engine,'resumenEjecucionFisica',{codEp:i.COD_EP,...p.physical}).rows[0]:{})}));
  if(p.latestBalance)rows=rows.map(r=>({...r,SALDO:sm.get(r.COD_EP)?.SALDO??null,FECHA_SALDO_REAL_UTILIZADA:sm.get(r.COD_EP)?.FECHA_SALDO_REAL_UTILIZADA??null}));
 }
 rows=rows.filter(r=>p.conditions.every(c=>meets(r,c))&&(!p.positiveExecution||typeof r.EJECUCION_MERESE==='number'&&r.EJECUCION_MERESE>0));
 if(p.followUp&&e.state.lastResultCodEps?.length===0&&p.level==='eps')rows=[];
 const count=rows.length;
 if(p.level==='national'&&!p.range){const physical=call(e.engine,'resumenEjecucionFisica',{}).rows[0];rows=[{AMBITO:'Perú',EPS:rows.length,EJECUCION_MERESE:sum(rows,'EJECUCION_MERESE'),SALDO:sum(rows,'SALDO'),...physical,EPS_SIN_DATO_SALDO:rows.filter(r=>r.SALDO==null).length,EPS_SIN_DATO_EJECUCION:rows.filter(r=>r.EJECUCION_MERESE==null).length}];}
 if(p.count){rows=[{[p.level==='interventions'?'INTERVENCIONES':p.level==='ods'?'ODS':'EPS']:count}];columns=Object.keys(rows[0]);}
 else if(!p.range){rows=rows.slice().sort((a,b)=>a[p.metric]==null?b[p.metric]==null?0:1:b[p.metric]==null?-1:(Number(a[p.metric])-Number(b[p.metric]))*(p.sort==='asc'?1:-1)||String(a.COD_EP??a.ODS??'').localeCompare(String(b.COD_EP??b.ODS??'')));if(p.limit)rows=rows.slice(0,p.limit);}
 if(!columns.length)columns=Object.keys(rows[0]??(p.range?{DESDE:0,HASTA:0}:p.level==='ods'?{ODS:0,[p.metric]:0}:{COD_EP:0,EPS:0,ODS:0,[p.metric]:0}));
 if(!p.summary&&!p.range&&!p.count&&p.level==='eps'){const needed=new Set(['COD_EP','EPS','ODS',p.metric,...p.conditions.map(c=>c.metric)]);if(needed.has('SALDO'))needed.add('FECHA_SALDO_REAL_UTILIZADA');columns=columns.filter(c=>needed.has(c));}
 const title=p.range?'Periodo disponible':p.level==='interventions'?'Intervenciones MERESE':p.level==='national'?'Resumen nacional':p.level==='ods'?'Consulta por ODS':'Consulta por EPS';
 const chart=!p.count&&!p.range&&p.level!=='interventions'&&rows.some(r=>typeof r[p.metric]==='number')?p.metric:undefined;
 return {title,description:'Consulta local determinística. Los faltantes se mantienen como —.',columns,rows,summary:`Se encontraron ${rows.length} registro(s)${p.limit?` de ${count} coincidencias`:''}.`,metadata:{desde:period.desde,hasta:period.hasta,corteSaldo:balanceUntil,totalRegistros:rows.length,intent:p.intent,criterios:p.conditions.map(c=>`${c.metric} ${c.op} ${c.value}`).join('; ')},chart};
}
