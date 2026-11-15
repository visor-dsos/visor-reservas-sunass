import type {Finance} from './interventionIndicators';
import type {Institution} from './mereseQueryEngine';
import {reserveSum,type ReserveRow} from './reserveMonitoring';
export type AnnualDetail={kind:'execution'|'balance';columns:string[];rows:ReserveRow[];note:string};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
// Table/export projection only. The accumulated chart rows remain unchanged.
export function annualDetail(finances:Record<string,Finance>,members:Institution[],from:string,to:string,kind:AnnualDetail['kind']):AnnualDetail{
 const records=members.map(i=>({i,records:(finances[i.COD_EP]?.implementacion??[]).filter(r=>(!from||r.fecha.slice(0,7)>=from)&&(!to||r.fecha.slice(0,7)<=to)).slice().sort((a,b)=>a.fecha.localeCompare(b.fecha))}));
 const dates=records.flatMap(x=>x.records.map(r=>r.fecha)).sort(),first=Number((from||dates[0]||'').slice(0,4)),last=Number((to||dates.at(-1)||'').slice(0,4));
 const years=first&&last&&last>=first?Array.from({length:Math.max(0,last-Math.max(2021,first)+1)},(_,i)=>String(Math.max(2021,first)+i)):[];
 const early=kind==='execution'&&records.some(x=>x.records.some(r=>r.fecha<'2021-01-01'&&finite(r.ejecucion)));
 const earlyKey=early?(first===Math.min(last,2020)?String(first):first+'–'+Math.min(last,2020)):null;
 const periods=[...(earlyKey?[earlyKey]:[]),...years];
 const rows=records.map(({i,records})=>{const row:ReserveRow={COD_EP:i.COD_EP,EPS:i.EP,ODS:i.ODS};for(const year of periods){const items=records.filter(r=>year===earlyKey?r.fecha<'2021-01-01':r.fecha.startsWith(year+'-'));if(kind==='execution')row[year]=reserveSum(items.map(r=>r.ejecucion).filter(finite));else{const last=items.filter(r=>finite(r.saldo)).at(-1);row[year]=last?.saldo??null;row['FECHA_'+year]=last?.fecha??null;}}if(kind==='execution')row.TOTAL=reserveSum(periods.map(y=>row[y] as number|null));return row;});
 return {kind,columns:['EPS','ODS',...periods,...(kind==='execution'?['TOTAL']:[])],rows,note:`Detalle por año calendario dentro de ${from} – ${to}. `+(kind==='execution'?'TOTAL suma los movimientos del rango, incluidos los anteriores a 2021 cuando existen.':'Cada año muestra su último saldo válido dentro del rango, sin arrastre ni suma entre años. Las fechas corresponden al registro real.')+' El último año puede ser parcial; los faltantes no equivalen a cero.'};
}
export function annualExportRows(detail:AnnualDetail,ordered:ReserveRow[]){
 const map=new Map(detail.rows.map(r=>[String(r.COD_EP),r])),rows=ordered.map(r=>map.get(String(r.COD_EP))!).filter(Boolean);
 if(detail.kind==='balance')return rows;
 const total:ReserveRow={EPS:'TOTAL GENERAL DEL ÁMBITO',ODS:''};for(const k of detail.columns.slice(2))total[k]=reserveSum(rows.map(r=>r[k] as number|null));return [...rows,total];
}
