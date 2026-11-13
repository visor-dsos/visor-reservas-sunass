export type ReserveBlock={programado:(number|null)[];ejecucion_real:(number|null)[];meta_gestion:(number|null)[]};
export type AnnualReserve={estimacion_anual:(number|null)[];ejecucion_anual:(number|null)[]};
export type Finance={ejeseparado?:{MERESE:AnnualReserve;GRD_ACC:AnnualReserve};reserva?:string;implementacion_grd_acc?:{fecha:string;ejecucion:number|null;saldo:number|null}[];implementacion:{fecha:string;ejecucion:number|null;saldo:number|null}[];regulatorio:{grd_acc?:ReserveBlock;ejecucion_real?:(number|null)[];FECHA_INICIO_PR?:string|null;DURACION_PR?:number|null;ANIO_REGULATORIO_VIGENTE?:number|null;PROGRAMADO_ACUMULADO_ANIO_1?:number|null;PROGRAMADO_ACUMULADO_ANIO_2?:number|null;PROGRAMADO_ACUMULADO_ANIO_3?:number|null;PROGRAMADO_ACUMULADO_ANIO_4?:number|null;PROGRAMADO_ACUMULADO_ANIO_5?:number|null;anio_vigente:number|null;programado:(number|null)[];meta_gestion?:(number|null)[];anio_meta_gestion_referencia?:number|null;pct_meta_gestion_referencia?:number|null}|null};
export const money=(n:number|null|undefined)=>n==null?'—':'S/ '+n.toLocaleString('en-US',{maximumFractionDigits:2});
export const number=(n:number|null|undefined)=>n==null?'—':n.toLocaleString('en-US',{maximumFractionDigits:1});
export const month=(s:string)=>s?new Date(s+'-02T12:00:00').toLocaleDateString('es-PE',{month:'short',year:'numeric'}):'—';
const sum=(v:(number|null|undefined)[])=>{const n=v.filter((x):x is number=>x!=null);return n.length?n.reduce((a,b)=>a+b,0):null};
export function financial(data:Finance[],from:string,to:string){
 const rows=data.flatMap(d=>d.implementacion).sort((a,b)=>a.fecha.localeCompare(b.fecha));
 const grd=data.length>0&&data.every(d=>d.reserva==='GRD y ACC');
 const last=rows.filter(r=>r.fecha.slice(0,7)<=to&&(!grd||r.saldo!=null)).at(-1);
 return {last,balance:sum(data.map(d=>d.implementacion.filter(r=>r.fecha.slice(0,7)<=to&&(!grd||r.saldo!=null)).at(-1)?.saldo)),total:sum(rows.filter(r=>r.fecha.slice(0,7)>=from&&r.fecha.slice(0,7)<=to).map(r=>r.ejecucion))};
}
export type PhysicalItem={COD_INTERVENCION:string;COD_EP:string;AREA_HA?:number|null;LONGITUD_KM?:number|null;CUENCAS:{COD_CUENCA:string;NOMBRE_CUENCA:string}[]};
export function physicalStats(items:PhysicalItem[]){const unique=[...new Map(items.map(i=>[i.COD_INTERVENCION,i])).values()];const total=(k:'AREA_HA'|'LONGITUD_KM')=>unique.some(i=>i[k]==null)?null:unique.reduce((n,i)=>n+i[k]!,0);return {area:total('AREA_HA'),length:total('LONGITUD_KM'),count:unique.length,eps:new Set(unique.map(i=>i.COD_EP)).size,basins:new Set(unique.flatMap(i=>i.CUENCAS.map(c=>c.COD_CUENCA))).size};}
export type ReportSnapshot={all:Record<string,Finance>;from:string;to:string;cards:(string|number)[][];year:number|null|undefined};
