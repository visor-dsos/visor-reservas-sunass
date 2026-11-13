import {entities} from './entities';
import {dates} from './dates';
import {operators,metricMatches} from './operators';
import {selectExtreme,type Extreme} from './extremes';
import {Clarification,type Environment,type Plan,type Metric} from './types';
import type {QueryResult} from '../../mereseQueryEngine';
const words:Record<string,number>={uno:1,un:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,primer:1,primero:1,primera:1,segundo:2,segunda:2,tercer:3,tercero:3,tercera:3,cuarto:4,cuarta:4,quinto:5,quinta:5,sexto:6,sexta:6,septimo:7,septima:7,octavo:8,octava:8,noveno:9,novena:9,decimo:10,decima:10};
const fold=(s:string)=>s.replace(new RegExp('\\b('+Object.keys(words).join('|')+')\\b','g'),w=>String(words[w]));
const direction=(s:string):'max'|'min'|undefined=>/\b(menor|menores|menos|minimo|minima)\b/.test(s)?'min':/\b(mayor|mayores|mas|maximo|maxima)\b/.test(s)?'max':undefined;
const threshold=/[<>]|(?:mayor|menor)(?:es)? (?:a|que|de) (?:soles )?\d|(?:mas|menos) de (?:soles )?\d/;
function metric(s:string,fallback:string){return /meta|gestion/.test(s)?'PCT_META_GESTION_REFERENCIA':/relacion|porcentaje.*programado/.test(s)?'PCT_RELACION_EJECUCION_PROGRAMADO':metricMatches(s)[0]?.metric??fallback;}
export function advancedQuery(text:string,e:Environment):{plan:Plan;result:QueryResult}|undefined{
 if(e.context.reserva)text=text.replace(/^compara estimacion y ejecucion$/,'compara estimacion y ejecucion del periodo regulatorio').replace(/estimacion vs ejecucion/g,'compara estimacion y ejecucion del periodo regulatorio').replace(/hasta el ano (\d+)/g,'acumulado hasta el ano $1').replace(/(estimacion y ejecucion del? ano) (\d+)/g,'$1 regulatorio $2');
 const prev=e.state.lastQueryPlan,follow=/^(y |ahora |tambien )|ese ano|de (?:esas|ellas|estas|ellos)/.test(text),prior=follow?prev?.advanced:undefined,t=fold(text);
 const meta=/\bmeta\b|gestion|\bq\s*[:–-]\s*u\b/.test(text);
 const pr=!meta&&!/historic/.test(text)&&(/periodo regulatorio|\bpr\b|primeros? \d+ anos|\d+ ano(?:s)? regulator|ano(?:s)? regulatorios? \d|acumulado hasta (?:el )?ano/.test(t)||prior?.kind==='pr'||/programad|debia recaudar|monto previsto/.test(t)&&/ejecu|compara|porcentaje|relacion/.test(t));
 const pieces=text.split(/\s+y\s+/).filter(s=>direction(s));
 const extremal=!threshold.test(t)&&!!direction(text)&&(/ejecut|saldo|area|hectarea|longitud|kilometro|intervenciones|meta|gestion|programad|\beps\b|cual|quien|la que|la de/.test(text)||!!prior);
 const ranked=/\btop\s+\d|\branking\b/.test(t);
 if(!pr&&!extremal&&!ranked)return;
 // Leave ordinary non-PR explicit numeric filters and regulatory-year questions untouched.
 if(!pr&&threshold.test(t))return;
 const ent=entities(text,e.institutions,e.context.codEp),explicit=dates(text),isSet=/de (?:esas|ellas|estas|ellos)|de las anteriores/.test(text);
 let codes=ent.codes.slice(),ods=ent.ods.slice();
 if(!codes.length&&isSet)codes=e.state.lastResultCodEps?.slice()??[];
 else if(!codes.length&&follow)codes=prev?.codes.slice()??[];
 const national=/nacional|\bperu\b|todas las eps/.test(text);
 if(!ods.length&&!codes.length&&!national)ods=follow&&prev?.ods.length?prev.ods.slice():e.context.ods?[e.context.ods]:[];
 const collective=extremal||ranked||/\beps (?:con|que|cuya)|que eps|las eps/.test(text);
 if(!codes.length&&pr&&!collective&&e.context.codEp)codes=[e.context.codEp];
 if(pr&&!collective&&!codes.length&&!/compara/.test(text))throw new Clarification('Selecciona una EPS o indica COD_EP para consultar su periodo regulatorio.');
 const period={desde:explicit.desde??(follow?prev?.period.desde:undefined)??e.context.desde,hasta:explicit.hasta??(follow?prev?.period.hasta:undefined)??e.context.hasta};
 const fallback=prior?.metric??(follow?prev?.metric:undefined)??'EJECUCION_MERESE';
 let m=metric(text,fallback),firstNYears:number|undefined,regulatoryYear:number|undefined,compare=false;
 if(pr){
  const first=t.match(/primeros? (\d+) anos?/),acc=t.match(/(?:acumulad\w*|hasta).*?(?:ano(?: regulatorio)?\s*(\d+)|ese ano)/),isolated=t.match(/(?:durante |en )?(?:su |el )?(\d+) ano(?: regulatorio)?|ano regulatorio\s*(\d+)/);
  if(first)firstNYears=Number(first[1]);else if(acc)firstNYears=acc[1]?Number(acc[1]):prior?.regulatoryYear??prior?.firstNYears;else if(isolated)regulatoryYear=Number(isolated[1]??isolated[2]);
  else if(/programad|estimad|estimacion|recaudar/.test(t)&&/al ano \d/.test(t))firstNYears=Number(t.match(/al ano (\d+)/)![1]);
  else if(prior?.kind==='pr'&&!/desde|al corte|pr vigente|periodo regulatorio vigente/.test(text)){firstNYears=prior.firstNYears;regulatoryYear=prior.regulatoryYear;}
  compare=/programad|estimad|estimacion|recaudar|monto previsto|debia programar/.test(text)||(prior?.compare??false)&&!isolated&&!acc;
  m=/relacion|porcentaje/.test(text)&&compare?'PCT_RELACION_EJECUCION_PROGRAMADO':'EJECUCION_PR';
 }
 const conditions=operators(t,'EJECUCION_MERESE');
 const p:Plan={intent:pr?(compare?'compararProgramadoEjecutadoPR':regulatoryYear?'ejecucionAnioRegulatorio':firstNYears?'ejecucionPrimerosNAnosPR':'ejecucionPeriodoRegulatorio'):'extremos',level:'eps',codes,ods,period,balanceUntil:period.hasta,latestBalance:false,conditions:conditions.length?conditions:follow?prev?.conditions??[]:[],metric:(['EJECUCION_MERESE','SALDO','AREA_HA','LONGITUD_KM','INTERVENCIONES'].includes(m)?m:'EJECUCION_MERESE') as Metric,sort:'desc',positiveExecution:false,physical:{},summary:false,count:false,range:false,followUp:follow,output:'table',confidence:1,original:text,advanced:{kind:pr?'pr':'extremes',firstNYears,regulatoryYear,compare,metric:m}};
 const members=e.institutions.filter(i=>(!e.context.scopeCodes||e.context.scopeCodes.includes(i.COD_EP))&&(!codes.length||codes.includes(i.COD_EP))&&(!ods.length||ods.includes(i.ODS)));
 let rows:QueryResult['rows']=members.map(i=>pr?(compare&&regulatoryYear!=null?e.engine.regulatoryAnnualComparison({codEp:i.COD_EP,regulatoryYear,cutoff:period.hasta}):e.engine.regulatoryPeriodExecution({codEp:i.COD_EP,firstNYears,regulatoryYear,compare,cutoff:period.hasta})).rows[0]:{...e.engine.consultarEPS({codEp:i.COD_EP,...period}).rows[0],PCT_META_GESTION_REFERENCIA:e.finances?.[i.COD_EP]?.regulatorio?.pct_meta_gestion_referencia??null});
 if(isSet&&e.state.lastResultCodEps?.length===0)rows=[];
 rows=rows.filter(r=>p.conditions.every(c=>{const v=r[pr&&c.metric==='EJECUCION_MERESE'?'EJECUCION_PR':c.metric];return typeof v==='number'&&(c.op==='gt'?v>c.value:c.op==='gte'?v>=c.value:c.op==='lt'?v<c.value:c.op==='lte'?v<=c.value:v===c.value)}));
 if(pr&&/supero|superaron|supera(?:ron)? lo programado/.test(t))rows=rows.filter(r=>typeof r.DIFERENCIA_PROGRAMADO_EJECUTADO==='number'&&r.DIFERENCIA_PROGRAMADO_EJECUTADO<0);
 const operations:Extreme[]=[];
 if(extremal||ranked){
  for(const part of pieces.length>1?pieces:[text]){
   const partFold=fold(part),pos=part.match(/\b(segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|septim[oa]|octav[oa]|noven[oa]|decim[oa])\b/)?.[1],position=pos?words[pos]:Number(part.match(/(?:posicion|puesto|numero)\s*(\d+)|\b(\d+)[.ºª°]+\s*eps/)?.slice(1).find(Boolean))||undefined;
   const limit=Number(partFold.match(/(?:top|las|los)\s+(\d+)\b/)?.[1])||undefined,plural=/\blas (?:\d+ )?(?:eps|que|con)|\beps con\b|\branking\b|\btop\b/.test(partFold)&&!/^la eps\b|\bque eps\b/.test(partFold);
   operations.push({operation:position||!plural&&!limit?'extreme':'ranking',metric:pr?m:metric(part,m),direction:direction(part)??'max',position,limit});
  }
  const multiple=operations.length>1;rows=operations.flatMap(q=>selectExtreme(rows,q).map(r=>({...r,EXTREMO:q.operation==='ranking'?'Ranking':q.direction==='max'?'Máximo':'Mínimo',POSICION:q.position??1,METRICA:q.metric,VALOR:r[q.metric]})));
  p.intent=pr?'rankingEjecucionPR':multiple?'extremos':'extremo';p.sort=operations[0].direction==='min'?'asc':'desc';p.limit=operations[0].operation==='extreme'?1:operations[0].limit;
 }
 const columns=pr?['COD_EP','EPS','ODS','FECHA_INICIO_PR','ANIO_REGULATORIO_VIGENTE','PERIODO_EVALUADO','HASTA_EVALUADO','FECHA_CORTE',...(extremal?['EXTREMO']:[]),...(compare?(regulatoryYear!=null?['ANIO_REGULATORIO','ESTIMACION_ANUAL']:['ANIO_PROGRAMADO','PROGRAMADO_ACUMULADO']):[]),'EJECUCION_PR',...(compare?(regulatoryYear!=null?['EJECUCION_ANUAL','DIFERENCIA_ESTIMACION_EJECUCION']:['DIFERENCIA_PROGRAMADO_EJECUTADO','PCT_RELACION_EJECUCION_PROGRAMADO']):[]),'ESTADO','NOTA']:['EXTREMO','POSICION','EPS','ODS','METRICA','VALOR'];
 const result:QueryResult={title:pr?(compare?'Programado y ejecución real del PR':'Ejecución del periodo regulatorio al corte'):'Extremos y ranking por EPS',description:pr?'Intervalos regulatorios [inicio, fin). Corte incluido; cada EPS usa su propia fecha. La relación ejecutado/programado NO es Meta de Gestión Q:U.':'Valores disponibles; cero incluido, null excluido. Posiciones por valor distinto (empates comparten puesto).',columns,rows,summary:`${rows.length} registro(s). ${pr?'Se informa el estado completo/parcial y las limitaciones por EPS.':'Se conservan empates exactos, incluidos los del límite del ranking.'}`,metadata:{intent:p.intent,desde:period.desde,hasta:period.hasta,operation:operations.length>1?'extremes':operations[0]?.operation??'regulatory',queries:JSON.stringify(operations)}};
 return {plan:p,result};
}
