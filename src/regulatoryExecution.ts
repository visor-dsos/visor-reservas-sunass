import type {Finance} from './interventionIndicators';
import type {Institution,QueryResult,Cell} from './mereseQueryEngine';
export type RegulatoryRequest={codEp:string;firstNYears?:number;regulatoryYear?:number;compare?:boolean;cutoff?:string};
const iso=(d:Date)=>d.toISOString().slice(0,10);
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&iso(new Date(s))===s;
// Calendar anniversaries: February 29 becomes February 28 in a non-leap year.
export function anniversary(s:string,n:number){const [y,m,d]=s.split('-').map(Number),year=y+n,last=new Date(Date.UTC(year,m,0)).getUTCDate();return iso(new Date(Date.UTC(year,m-1,Math.min(d,last))));}
const dayBefore=(s:string)=>iso(new Date(Date.parse(s)-86400000));
const monthEnd=(s:string)=>s.length===7?iso(new Date(Date.UTC(Number(s.slice(0,4)),Number(s.slice(5,7)),0))):s;
export function regulatoryOperations(finances:Record<string,Finance>,institutions:Institution[]){
 const regulatoryPeriodExecution=(p:RegulatoryRequest):QueryResult=>{
  const i=institutions.find(i=>i.COD_EP===p.codEp);if(!i)throw Error('COD_EP no reconocido.');
  for(const n of [p.firstNYears,p.regulatoryYear])if(n!=null&&(!Number.isInteger(n)||n<1||n>200))throw Error('Indica un año regulatorio entero entre 1 y 200.');
  if(p.firstNYears!=null&&p.regulatoryYear!=null)throw Error('Indica acumulado o año aislado, no ambos.');
  const f=finances[p.codEp],r=f?.regulatorio,d=r?.FECHA_INICIO_PR,arv=r?.ANIO_REGULATORIO_VIGENTE??r?.anio_vigente??null,duration=r?.DURACION_PR??null;
  const notes:string[]=[];let n=p.regulatoryYear??p.firstNYears,programYear=n;
  if(p.compare&&n==null){n=arv==null?undefined:Math.min(arv,5);programYear=n;}
  if(duration==null)notes.push('Duración del PR no disponible; se utiliza la información disponible.');
  const outside=p.regulatoryYear!=null&&duration!=null&&p.regulatoryYear>duration;
  if(n!=null&&duration!=null&&n>duration){notes.push(`El periodo regulatorio configurado para esta EPS tiene una duración de ${duration} años.`);if(!outside)n=duration;if(p.firstNYears!=null)programYear=n;}
  if(p.compare&&arv!=null&&arv>5)notes.push('Programado disponible hasta año 5; la ejecución comparable no es la ejecución PR completa al corte.');
  const row:Record<string,Cell>={COD_EP:i.COD_EP,EPS:i.EP,ODS:i.ODS,FECHA_INICIO_PR:d??null,DURACION_PR:duration,ANIO_REGULATORIO_VIGENTE:arv,ANIO_EVALUADO:n??null,PERIODO_EVALUADO:null,FECHA_CORTE:null,EJECUCION_PR:null,ESTADO:'Sin datos',NOTA:null};
  const rawCut=p.cutoff?monthEnd(p.cutoff):undefined;if(rawCut&&!validDate(rawCut))throw Error('Fecha de corte inválida.');
  const dates=(f?.implementacion??[]).map(x=>x.fecha).filter(validDate).sort(),latest=dates.at(-1),cut=latest?(rawCut&&rawCut<latest?rawCut:latest):undefined;row.FECHA_CORTE=cut??null;
  if(!d||!validDate(d))notes.push('Fecha Inicio PR no disponible o inválida.');
  else if(outside)notes.push('El año aislado solicitado está fuera del periodo contractual; no se sustituye por otro año.');
  else if(p.compare&&n==null)notes.push('Año regulatorio vigente no disponible para la comparación.');
  else{
   const start=p.regulatoryYear?anniversary(d,p.regulatoryYear-1):d,end=n!=null?anniversary(d,n):undefined;
   const until=cut&&(end&&dayBefore(end)<cut?dayBefore(end):cut);row.PERIODO_EVALUADO=`[${start}, ${end??'corte incluido'})`;row.INICIO_EVALUADO=start;row.FIN_EXCLUSIVO=end??null;row.HASTA_EVALUADO=until??null;
   if(cut&&cut>=start){const rows=f.implementacion.filter(x=>x.fecha>=start&&(!end||x.fecha<end)&&x.fecha<=cut),values=rows.map(x=>x.ejecucion).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));row.EJECUCION_PR=values.length?values.reduce((a,b)=>a+b,0):null;row.ESTADO=end?(cut<dayBefore(end)?'Periodo parcial':'Periodo completo'):'Al corte';if(rows.some(x=>x.ejecucion==null))notes.push('Existen ejecuciones faltantes; se suman solo importes disponibles.');}
   else notes.push('No existen datos al corte dentro del periodo solicitado.');
  }
  if(p.compare){const program=programYear!=null&&programYear<=5?(r?.programado[programYear-1]??null):null,executed=row.EJECUCION_PR;
   Object.assign(row,{ANIO_PROGRAMADO:programYear??null,PROGRAMADO_ACUMULADO:program,DIFERENCIA_PROGRAMADO_EJECUTADO:typeof program==='number'&&typeof executed==='number'?program-executed:null,PCT_RELACION_EJECUCION_PROGRAMADO:typeof program==='number'&&program>0&&typeof executed==='number'?executed/program*100:null});
   if(program===0)notes.push('Relación no calculable: programado igual a cero.');if(programYear!=null&&programYear>5)notes.push('No existe programado G:K para años posteriores a 5.');
  }
  row.NOTA=notes.join(' ');
  return {title:p.compare?'Programado y ejecución real del PR':'Ejecución del periodo regulatorio al corte',description:'Ejecución real de Implementacion; intervalos [inicio, fin), corte incluido. No utiliza Meta de Gestión Q:U.',columns:Object.keys(row),rows:[row],summary:notes.join(' ')||String(row.ESTADO),metadata:{concepto:'Ejecución PR',intervalo:'[inicio, fin)',corte:cut}};
 };
 const regulatoryAnnualComparison=(p:RegulatoryRequest&{regulatoryYear:number})=>{
  const result=regulatoryPeriodExecution({...p,compare:false,firstNYears:undefined}),row=result.rows[0],r=finances[p.codEp]?.regulatorio,n=p.regulatoryYear,ar=r?.ANIO_REGULATORIO_VIGENTE??r?.anio_vigente;
  const applicable=n<=5&&(ar==null||n<=ar)&&(r?.DURACION_PR==null||n<=r.DURACION_PR)&&typeof row.INICIO_EVALUADO==='string'&&typeof row.FECHA_CORTE==='string'&&row.INICIO_EVALUADO<=row.FECHA_CORTE;
  const current=r?.programado[n-1],previous=n===1?0:r?.programado[n-2],annual=applicable&&current!=null&&previous!=null?current-previous:null,executed=applicable?row.EJECUCION_PR:null,source=r?.meta_gestion?.[n-1]??null,calculated=typeof annual==='number'&&annual>0&&typeof executed==='number'?executed/annual*100:null;
  Object.assign(row,{ANIO_REGULATORIO:n,APLICABLE:applicable?1:0,ESTIMACION_ANUAL:annual,EJECUCION_ANUAL:executed,PCT_META_GESTION_FUENTE:source,PCT_META_GESTION_CALCULADO:calculated,DIFERENCIA_META_PP:source!=null&&calculated!=null?calculated-source:null,DIFERENCIA_ESTIMACION_EJECUCION:annual!=null&&typeof executed==='number'?annual-executed:null});
  return {...result,title:'Comparación del mismo año regulatorio',description:'Estimación anual = diferencia de programados acumulados G:K; ejecución aislada del mismo año. Q:U se conserva como fuente.',columns:Object.keys(row)};
 };
 return {regulatoryPeriodExecution,regulatoryYearExecution:(p:RegulatoryRequest&{regulatoryYear:number})=>regulatoryPeriodExecution(p),regulatoryAnnualComparison};
}
