import type {Finance} from './interventionIndicators';
import type {ReserveRow} from './reserveMonitoring';
// Presentation evidence only: amounts and regulatory calculations remain untouched.
export function executionEvidence(rows:ReserveRow[],finances:Record<string,Finance>,from:string,to:string):ReserveRow[]{
 return rows.map(row=>{const records=(finances[String(row.COD_EP)]?.implementacion??[]).filter(r=>r.fecha.slice(0,7)>=from&&r.fecha.slice(0,7)<=to),values=records.filter(r=>typeof r.ejecucion==='number'&&Number.isFinite(r.ejecucion)),positive=typeof row.EJECUCION_PERIODO==='number'&&row.EJECUCION_PERIODO>0;
 return {...row,ESTADO_EJECUCION:positive?'Con ejecución reportada':'No determinable con la fuente disponible',REGISTROS_EJECUCION:values.length,CEROS_EN_FUENTE:values.filter(r=>r.ejecucion===0).length,SIN_DATO_EN_FUENTE:records.length-values.length,PRIMER_DATO:values[0]?.fecha??null,ULTIMO_DATO:values.at(-1)?.fecha??null,EVIDENCIA:positive?'Importe positivo reportado en el periodo; no acredita cobertura completa de reportes.':'Los ceros existentes no acreditan por sí solos un reporte completo del periodo ni una condición tarifaria. No se presume incumplimiento.'};});
}
export function territorialRows(rows:ReserveRow[],group:'REGION'|'ODS'|'EPS',metric:string):ReserveRow[]{
 const groups=new Map<string,ReserveRow[]>();for(const row of new Map(rows.map(r=>[String(r.COD_EP),r])).values()){const key=String(row[group]??'Sin información territorial');groups.set(key,[...(groups.get(key)??[]),row]);}
 const total=rows.map(r=>r[metric]).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)).reduce((s,v)=>s+v,0);
 return [...groups].map(([name,members])=>{const values=members.map(r=>r[metric]).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)),value=values.length?values.reduce((s,v)=>s+v,0):null;return {AMBITO:name,EPS:members.length,EPS_CON_DATO:values.length,MONTO:value,PCT_PARTICIPACION:value!=null&&total>0?value/total*100:null};});
}
