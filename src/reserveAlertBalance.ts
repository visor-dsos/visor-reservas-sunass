import type {Finance} from './interventionIndicators';
import {anniversary} from './regulatoryExecution';
import type {Cell} from './mereseQueryEngine';
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function evaluatedBalance(f:Finance|undefined,year:number|null,cutoff:string){
 const start=f?.regulatorio?.FECHA_INICIO_PR,ar=f?.regulatorio?.ANIO_REGULATORIO_VIGENTE??f?.regulatorio?.anio_vigente;
 const empty={SALDO_EVALUADO:null as number|null,FECHA_SALDO_EVALUADO:null as string|null,ESTADO_SALDO_EVALUADO:ar===1?'No aplica':'No disponible',INICIO_ANIO_EVALUADO:null as string|null,FIN_ANIO_EVALUADO:null as string|null};
 if(!start||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(Date.parse(start))||year==null||!Number.isInteger(year)||year<1)return empty;
 const from=anniversary(start,year-1),until=anniversary(start,year);
 const rows=(f?.implementacion??[]).filter(r=>finite(r.saldo)&&r.fecha>=from&&r.fecha<until&&(!cutoff||(cutoff.length===7?r.fecha.slice(0,7)<=cutoff:r.fecha<=cutoff))).slice().sort((a,b)=>a.fecha.localeCompare(b.fecha)),last=rows.at(-1);
 return {...empty,SALDO_EVALUADO:last?.saldo??null,FECHA_SALDO_EVALUADO:last?.fecha??null,ESTADO_SALDO_EVALUADO:last?'Disponible':empty.ESTADO_SALDO_EVALUADO,INICIO_ANIO_EVALUADO:from,FIN_ANIO_EVALUADO:new Date(Date.parse(until)-86400000).toISOString().slice(0,10)};
}
export function sunassAlert(r:Record<string,Cell>){
 if(!finite(r.ANIO_EVALUADO)||r.ANIO_EVALUADO<1||r.INICIO_ANIO_EVALUADO==null)return 'No determinable';
 const balance=r.SALDO_EVALUADO,percent=r.PCT_EJECUCION_ACUMULADA;
 if(finite(balance)&&balance<=1000000||finite(percent)&&percent>=25)return 'No';
 return finite(balance)&&finite(percent)?'Sí':'No determinable';
}
export const alertExportColumns=['EPS','ODS','SALDO','FECHA_ULTIMO_SALDO','SALDO_EVALUADO','FECHA_SALDO_EVALUADO','ESTADO_SALDO_EVALUADO','ANIO_EVALUADO','PCT_EJECUCION_ACUMULADA','ALERTA_SUNASS'];
export function balanceDate(value:unknown){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value.split('-').reverse().join('/'):'No disponible';}
