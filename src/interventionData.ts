import {correctMasterRegions} from './masterRegionCorrections';
import {runtimeMode,runtimePointer} from './runtimeData';
import type {Finance} from './interventionIndicators';
// One immutable generation per page. Reload to adopt the next atomic pointer.
let version:Promise<string>|undefined;
export function interventionBase(){
 // Intervention sources remain independent from the financial runtime.
 return version??=fetch('/data/intervenciones_prototipo/current.json',{cache:'no-store'}).then(async r=>{
  if(r.status===404)return '/data/intervenciones_prototipo/';
  if(!r.ok)throw Error('No se pudo cargar la versión de intervenciones.');
  const p=await r.json();
  if(!/^\/data\/intervenciones_prototipo\/versions\/[A-Za-z0-9_-]+\/$/.test(p.base))throw Error('Versión de datos no válida.');
  return p.base as string;
 });
}

let runtimeSnapshot:ReturnType<typeof runtimePointer>|undefined;
const snapshot=()=>runtimeSnapshot??=runtimePointer();
export async function loadReserveMaster(){const p=runtimeMode?await snapshot():null;return {pointer:p,master:p?.master_version?await fetch(p.base+'maestro_eps.json').then(r=>{if(!r.ok)throw Error('Maestro EPS no disponible');return r.json().then(correctMasterRegions)}):null};}
let financialData:Promise<Record<string,Finance>>|undefined;
export function loadFinancialData(){return financialData??=(runtimeMode?snapshot().then(p=>fetch(p?p.base+'finanzas_eps.json':'/data/reservas/finanzas_eps.json')):fetch('/data/reservas/finanzas_eps.json')).then(async r=>{if(!r.ok)throw Error('No se pudo cargar el derivado financiero.');return (await r.json()).eps as Record<string,Finance>});}
