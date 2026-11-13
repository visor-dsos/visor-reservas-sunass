import type {Finance} from './interventionIndicators';
export type Reserve='MERESE'|'GRD_ACC';
export const reserveLabel=(r:Reserve)=>r==='GRD_ACC'?'GRD y ACC':'MERESE';
// A read-only thematic view feeds the existing financial engine. No second calculator.
export function selectReserve(finances:Record<string,Finance>,reserve:Reserve):Record<string,Finance>{
 if(reserve==='MERESE')return finances;
 return Object.fromEntries(Object.entries(finances).map(([code,f])=>{
  const r=f.regulatorio,b=r?.grd_acc,programado=b?.programado??Array(5).fill(null),meta=b?.meta_gestion??Array(5).fill(null);
  const ref=r?.anio_meta_gestion_referencia??(r?.anio_vigente!=null?Math.min(Math.max(r.anio_vigente-1,1),5):null);
  return [code,{...f,reserva:reserveLabel(reserve),implementacion:f.implementacion_grd_acc??[],regulatorio:r?{...r,programado,ejecucion_real:b?.ejecucion_real??Array(5).fill(null),meta_gestion:meta,pct_meta_gestion_referencia:ref?meta[ref-1]:null,...Object.fromEntries(programado.map((v,i)=>['PROGRAMADO_ACUMULADO_ANIO_'+(i+1),v]))}:null}];
 }));
}
