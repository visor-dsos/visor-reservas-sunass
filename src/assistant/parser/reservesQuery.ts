import {analyticRows,analyticSummary,definitions,recognizedTimeline,type ReserveContextData} from '../../reserveAnalytics';
import {selectReserve} from '../../reserveSelection';
import {createMereseQueryEngine} from '../../mereseQueryEngine';
import {entities} from './entities';
import {dates} from './dates';
import {operators} from './operators';
import {regulatoryValue} from './regulatoryRules';
import {selectExtreme} from './extremes';
import {Clarification,type Environment,type Plan} from './types';
import {calendarHistory,reserveRows,reserveTotals,reserveEstimates,reserveSum,reserveFlag,reserveTimeline,annualSource,completedYear,cumulativeYear} from '../../reserveMonitoring';
import type {QueryResult} from '../../mereseQueryEngine';

// Adapter for Reservas only. The shared engine and other modules keep their contracts.
export function reserveEnvironment(text:string,e:Environment):Environment{
 if(!e.context.reserva)return e;
 if(/\bambas\b/.test(text))throw new Clarification('Selecciona una sola temática.');
 const reserve=/\bgrd\b|\bacc\b/.test(text)?'GRD_ACC':/\bmerese\b/.test(text)?'MERESE':(e.state.reserve??e.context.reserva)==='GRD_ACC'?'GRD_ACC':'MERESE';
 // Preserve geographical and size context when switching reserve.
 e.state.reserve=reserve;
 const finances=selectReserve(e.finances??{},reserve);
 e={...e,finances,engine:createMereseQueryEngine(finances,e.institutions,[]),context:{...e.context,reserva:reserve}};
 const selectionText=text.replace(/(?:excluyendo|excepto|sin incluir)\s+.+$/,'');
 const ent=entities(selectionText,e.institutions,e.context.codEp),participation=/porcentaje.*(?:nacional|corresponde|representa)|participacion/.test(text),national=/nacional|\bperu\b|todas las eps/.test(text);
 const explicit=ent.codes.length||ent.ods.length||national;
 const ar=text.match(/eps en ano regulatorio (\d+)/)?.[1]??e.context.anioRegulatorio;
 const codes=e.institutions.filter(i=>{const r=e.finances?.[i.COD_EP]?.regulatorio,n=r?.ANIO_REGULATORIO_VIGENTE??r?.anio_vigente;return (!ar||ar==='Todos'||(ar==='>5'?n!=null&&n>5:n===Number(ar)))&&(participation?true:explicit?(!ent.codes.length||ent.codes.includes(i.COD_EP))&&(!ent.ods.length||ent.ods.includes(i.ODS)):!e.context.scopeCodes||e.context.scopeCodes.includes(i.COD_EP))}).map(i=>i.COD_EP);
 const slots=reserveSlots(text);
 if(ent.codes.length&&!/tamano|categoria/.test(text))slots.sizes=slots.sizes.filter(s=>s!=='SEDAPAL');
 if(slots.regions.length===1)e.state.region=slots.regions[0];
 if(slots.sizes.length===1)e.state.size=slots.sizes[0];
 const region=slots.regions.length>1?'':e.state.region??e.context.region,size=slots.sizes.length>1?'':e.state.size??e.context.size;
 const filtered=codes.filter(c=>(!region||e.context.reserveData?.master?.[c]?.REGION===region)&&(!size||e.context.reserveData?.master?.[c]?.T_EPS===size));
 return {...e,context:{...e.context,region,size,scopeCodes:filtered,...(explicit?{ods:ent.ods.length===1?ent.ods[0]:undefined,codEp:ent.codes.length===1?ent.codes[0]:undefined}:{})}};
}
export function reservesQuery(text:string,e:Environment):{plan:Plan;result:QueryResult}|undefined{
 if(!e.context.reserva)return;
 const calendar=calendarReserves(text,e);if(calendar)return calendar;
 const annual=annualReserves(text,e);if(annual)return annual;
 const extended=expandedReserves(text,e);if(extended)return extended;
 if(/comparar? con otra eps|compara con otra eps/.test(text))throw new Clarification('Indica el nombre o COD_EP de la otra EPS.');
 const compareScope=/comparar? eps de esta ods/.test(text),comparePrevious=/comparala|comparalo|comparar? (?:esa|esta) con la/.test(text);
 const summary=/^(resume|resumen|situacion)\b/.test(text),estimate=/valor estimado de recaudacion|estimacion total/.test(text);
 const critical=/indicador rojo|eps criticas/.test(text)||/saldo/.test(text)&&(/meta|gestion|%/.test(text));
 const meta=/meta|gestion|%.*ejecucion|ejecucion.*%|porcentaje de ejecucion/.test(text)&&!/(relacion|respecto).*saldo|meta calculada/.test(text);
 // History/specific Q:U years remain in the existing regulatory module.
 if(!compareScope&&!comparePrevious&&!summary&&!estimate&&!critical&&(!meta||/historico|historia/.test(text)))return;
 if(meta&&!critical&&!summary&&!/eps en ano regulatorio/.test(text)&&/ano(?: regulatorio)? \d/.test(text))return;
 if(/compara.*otra eps/.test(text))throw new Clarification('Indica el nombre o COD_EP de la otra EPS.');
 const ent=entities(text,e.institutions,e.context.codEp),d=dates(text),previous=e.state.lastQueryPlan;
 const follow=!!previous&&!ent.codes.length&&!ent.ods.length&&/de esas|de ellas|de estas|cual tiene|su meta|y la|de las anteriores/.test(text);
 const codes=comparePrevious?(e.state.reserveComparisonCodes??[]):ent.codes.length?ent.codes:follow?e.state.lastResultCodEps??[]:e.context.codEp?[e.context.codEp]:[];
 const ods=ent.ods.length?ent.ods:e.context.ods?[e.context.ods]:[];
 const period={desde:d.desde??(follow?previous?.period.desde:undefined)??e.context.desde,hasta:d.hasta??(follow?previous?.period.hasta:undefined)??e.context.hasta};
 const members=e.institutions.filter(i=>(!e.context.scopeCodes||e.context.scopeCodes.includes(i.COD_EP))&&(!codes.length||codes.includes(i.COD_EP))&&(!ods.length||ods.includes(i.ODS))&&(!follow||codes.includes(i.COD_EP)));
 const finances=e.finances??{};
 let rows:QueryResult['rows']=reserveRows(e.engine,finances,members,period.desde??'',period.hasta??'','vigente').map(r=>({...r,EJECUCION_MERESE:r.EJECUCION_PERIODO,PCT_EJECUCION_ACUMULADA:r.PCT_EJECUCION_ACUMULADA,ESTIMACION_TOTAL_PR:reserveEstimates(finances[String(r.COD_EP)]).total}));
 const plan:Plan={intent:'consultaReservas',level:codes.length===1?'eps':ods.length?'ods':'national',codes,ods,period,balanceUntil:period.hasta,latestBalance:false,conditions:[],metric:'EJECUCION_MERESE',sort:'desc',positiveExecution:false,physical:{},summary,count:false,range:false,followUp:follow,output:'table',confidence:1,original:text};
 let output:QueryResult['rows']=rows,columns:string[],title='Consulta de Reservas',chart:string|undefined;
 if(compareScope){output=rows;columns=['COD_EP','EPS','ODS','SALDO','EJECUCION_MERESE','ESTIMACION_TOTAL_PR','PCT_EJECUCION_ACUMULADA'];title='Comparación de EPS de la ODS';}
 else if(comparePrevious){const chosen=e.state.lastResultCodEps??[];const maxima=selectExtreme(rows,{operation:'extreme',metric:/saldo/.test(text)?'SALDO':'EJECUCION_MERESE',direction:/menor/.test(text)?'min':'max'});output=rows.filter(r=>chosen.includes(String(r.COD_EP))||maxima.some(m=>m.COD_EP===r.COD_EP));columns=['COD_EP','EPS','ODS','SALDO','EJECUCION_MERESE','PCT_EJECUCION_ACUMULADA'];title='Comparación contextual';}
 else if(summary){
  if(codes.length===1){columns=['COD_EP','EPS','ODS','SALDO','EJECUCION_MERESE','ANIO_REGULATORIO_VIGENTE','FECHA_INICIO_PR','DURACION_PR','ESTIMACION_TOTAL_PR','EJECUCION_PR','PCT_EJECUCION_ACUMULADA'];title='Resumen EPS';}
  else{const totals=reserveTotals(finances,rows,period.desde??'',period.hasta??'');output=[{AMBITO:ods.join(', ')||'Perú',SALDO:totals.saldo,EJECUCION_MERESE:totals.ejecucion,EPS_CON_EJECUCION:totals.conEjecucion,EPS_SIN_EJECUCION:totals.sinEjecucion,ESTIMACION_TOTAL_PR:reserveSum(rows.map(r=>r.ESTIMACION_TOTAL_PR as number|null)),...(!ods.length?{EPS_SALDO_ALTO_META_BAJA:rows.filter(reserveFlag).length}:{})}];columns=Object.keys(output[0]);title=ods.length?'Resumen ODS':'Resumen nacional';}
 }else if(estimate){output=codes.length===1?rows:[{AMBITO:ods.join(', ')||'Perú',ESTIMACION_TOTAL_PR:reserveSum(rows.map(r=>r.ESTIMACION_TOTAL_PR as number|null))}];columns=codes.length===1?['COD_EP','EPS','ODS','DURACION_PR','ESTIMACION_TOTAL_PR']:['AMBITO','ESTIMACION_TOTAL_PR'];title='Valor Estimado de Recaudación';}
 else{
  const op='(>=|<=|>|<|mayor(?:es)?(?: a| al| que)?|menor(?:es)?(?: a| al| que)?|menos de|mas de|igual a)';
  const target=text.match(new RegExp('(?:meta(?: de gestion| oficial)?|gestion|ejecucion)\\s*'+op+'\\s*(\\d+(?:[.,]\\d+)?)\\s*%?'))??text.match(new RegExp(op+'\\s*(\\d+(?:[.,]\\d+)?)\\s*%'));
  const metaText=target?text.replace(target[0],''):text;
  if(critical&&/indicador rojo|eps criticas|1mm/.test(text))rows=rows.filter(reserveFlag);
  else{
   const conditions=operators(metaText.replace(/meta(?: de gestion| oficial)?/g,''),'SALDO');
   rows=rows.filter(r=>conditions.every(c=>{const v=r[c.metric];return typeof v==='number'&&(c.op==='gt'?v>c.value:c.op==='gte'?v>=c.value:c.op==='lt'?v<c.value:c.op==='lte'?v<=c.value:v===c.value)}));
   if(target){const value=Number(target[2].replace(',','.')),o=target[1];rows=rows.filter(r=>{const v=r.PCT_EJECUCION_ACUMULADA;return typeof v==='number'&&(/^(>=)/.test(o)?v>=value:/^(<=)/.test(o)?v<=value:/^(>|mayor|mas)/.test(o)?v>value:/^(<|menor|menos)/.test(o)?v<value:v===value)});}
  }
  output=rows;const ranking=/top|ranking|mayor|menor|mas baja|mas alta/.test(text)&&!target;
  if(ranking){e.state.reserveComparisonCodes=rows.map(r=>String(r.COD_EP));const limit=Number(text.match(/top (\d+)/)?.[1])||undefined;output=selectExtreme(output,{metric:'PCT_EJECUCION_ACUMULADA',direction:/menor|baja/.test(text)?'min':'max',operation:/cual|que eps/.test(text)?'extreme':'ranking',limit});}
  columns=['COD_EP','EPS','ODS','SALDO','EJECUCION_MERESE','ANIO_REGULATORIO_VIGENTE','META_ANIO_REFERENCIA','PCT_EJECUCION_ACUMULADA'];title=critical?'Alerta SUNASS':'% Ejecución Acumulada';chart='PCT_EJECUCION_ACUMULADA';
 }
 return {plan,result:{title,description:'Mismas reglas del dashboard; COD_EP; Ejeseparado anual, año evaluado y estimación del PR completo. Faltantes distintos de cero.',columns,rows:output,summary:output.length+' registro(s).',metadata:{desde:period.desde,hasta:period.hasta,intent:plan.intent},chart}};
}

export function reserveSlots(text:string){
 const regions=['Costa','Sierra','Selva'].filter(r=>new RegExp('\\b'+r.toLowerCase()+'\\b').test(text));
 const sizes=Object.entries({P:/\bpequenas?\b|\btamano p\b|\beps p\b/,M:/\bmedianas?\b|\btamano m\b|\beps m\b/,G1:/\bg1\b|\bgrandes? 1\b/,G2:/\bg2\b|\bgrandes? 2\b/,SEDAPAL:/\bsedapal\b/}).filter(([,rx])=>rx.test(text)).map(([k])=>k);
 return {regions,sizes};
}
function expandedReserves(text:string,e:Environment):{plan:Plan;result:QueryResult}|undefined{
 // Extension of the existing Reservas adapter, using the same rows as the dashboard.
 if(!e.context.reserveData)return;
 const relevant=/valor estimado|estimacion|ejecucion pr|ejecucion total|resumen|resume|reconocido|aprobado|conexion|hectarea|\bha\b|interes hidrico|cuencas|alerta|priori|asistencia tecnica|atender primero|situacion|persistente|incompleta|antigu|rezagad|saldo elevado|baja mg|region|tamano|costa|sierra|selva|pequena|mediana|\bg[12]\b|sedapal|sin ejecucion con saldo|por que|ordenalas|solo|compara|cuantas|cuantos|evolucion|normalizados/.test(text);
 if(!relevant&&!e.state.region&&!e.state.size&&!e.context.region&&!e.context.size)return;
 if(/historico meta|ano regulatorio \d|ano \d/.test(text)&&!/reconocido|aprobado/.test(text))return;
 const slots=reserveSlots(text),ent=entities(text,e.institutions,e.context.codEp),d=dates(text),from=d.desde??e.context.desde??'',to=d.hasta??e.context.hasta??'';
 const territory=/hectarea|\bha\b|interes hidrico|cuencas/.test(text);
 const prior=/priori|asistencia tecnica|atender primero|esta primera/.test(text),alert=/alerta/.test(text),why=/por que|motivo|explica/.test(text),definition=/que (?:es|significa)\b|como se prioriza/.test(text);
 let metric=/saldo.*conexion/.test(text)?'SALDO_CONEXION':/reconocido.*conexion/.test(text)?'RECONOCIDO_CONEXION':/ejecu.*conexion/.test(text)?'EJECUCION_1000':/ha.*millon/.test(text)?'HA_MILLON':territory?/ejecu|eficiencia/.test(text)?'EJECUCION_HA':'AREA_INTERES_HA':/acumulado reconocido/.test(text)?'RECONOCIDO_AVANCE':/valor estimado|estimacion|reconocido|aprobado/.test(text)?'RECONOCIDO_PR':/ejecucion pr/.test(text)?'EJECUCION_PR':/ejecucion total/.test(text)?'EJECUCION_TOTAL':/porcentaje|%|acumulada/.test(text)?'PCT_EJECUCION_ACUMULADA':/meta|\bmg\b/.test(text)?'PCT_META_REFERENCIA':/saldo/.test(text)?'SALDO':/ejecu/.test(text)?'EJECUCION_PERIODO':e.state.analyticMetric??'SALDO';
 const plan:Plan={intent:prior?'PRIORITIZATION_AT':'consultaReservasAnalitica',level:e.context.codEp?'eps':e.context.ods?'ods':'national',codes:ent.codes,ods:ent.ods,period:{desde:from,hasta:to},latestBalance:false,conditions:[],metric:'SALDO',sort:/menor/.test(text)?'asc':'desc',positiveExecution:false,physical:{},summary:false,count:false,range:false,followUp:!!e.state.lastResult,output:'table',confidence:1,original:text};
 const make=(rows:QueryResult['rows'],title:string,columns=Object.keys(rows[0]??{}),description='Mismo contexto y reglas del dashboard. Totales disponibles; % acumulada promedio simple entre EPS con datos válidos; faltantes distintos de cero.')=>({plan,result:{title,columns,rows,description,summary:rows.length+' registro(s).',metadata:{desde:from,hasta:to,reserva:e.context.reserva,region:e.context.region,size:e.context.size}}});
 if(territory&&e.context.reserva!=='MERESE')return make([{MENSAJE:'El indicador territorial por área de interés hídrico se aplica actualmente a MERESE.'}],'Indicador territorial');
 if(definition){const key=prior?'POSICION_AT':alert?'ALERTA_SUNASS':/situaci/.test(text)?'SITUACIONES':metric;return make([{INDICADOR:key,DEFINICION:definitions[key]??definitions.EJECUCION_PERIODO}],'Definiciones de indicadores');}
 let members=e.institutions.filter(i=>(!e.context.scopeCodes||e.context.scopeCodes.includes(i.COD_EP))&&(!ent.codes.length||ent.codes.includes(i.COD_EP))&&(!ent.ods.length||ent.ods.includes(i.ODS)));
 // Multi-group comparisons expand only the dimension explicitly being compared.
 const compare=/compara|respecto/.test(text),groupCompare=compare&&(slots.regions.length>1||slots.sizes.length>1||/regiones|tamanos/.test(text));
 if(groupCompare)members=e.institutions.filter(i=>(!e.context.ods||i.ODS===e.context.ods)&&(!e.context.region||slots.regions.length>1||/regiones/.test(text)||e.context.reserveData?.master?.[i.COD_EP]?.REGION===e.context.region)&&(!e.context.size||slots.sizes.length>1||/tamanos/.test(text)||e.context.reserveData?.master?.[i.COD_EP]?.T_EPS===e.context.size)&&(!e.context.anioRegulatorio||e.context.anioRegulatorio==='Todos'||(e.context.anioRegulatorio==='>5'?Number(e.finances?.[i.COD_EP]?.regulatorio?.anio_vigente)>5:e.finances?.[i.COD_EP]?.regulatorio?.anio_vigente===Number(e.context.anioRegulatorio))));
 let rows=analyticRows(e.engine,e.finances??{},members,from,to,e.context.reserva!,e.context.reserveData);
 if(groupCompare){const byRegion=slots.regions.length>1||/regiones/.test(text),groups=byRegion?(slots.regions.length?slots.regions:['Costa','Sierra','Selva']):(slots.sizes.length?slots.sizes:['P','M','G1','G2','SEDAPAL']);return make(groups.map(g=>analyticSummary(rows.filter(r=>r[byRegion?'REGION':'T_EPS']===g),g)),'Comparación territorial / tamaño');}
 if(/que region.*mayor/.test(text)){const summaries=['Costa','Sierra','Selva'].map(g=>analyticSummary(rows.filter(r=>r.REGION===g),g));return make(summaries.filter(r=>r[metric]!=null).sort((a,b)=>Number(b[metric])-Number(a[metric])).slice(0,1),'Región con mayor valor');}
 if(/sin ejecucion/.test(text))rows=rows.filter(r=>r.EJECUCION_PERIODO===0&&(!/con saldo/.test(text)||Number(r.SALDO)>0));
 else if(/tienen ejecucion|con ejecucion/.test(text))rows=rows.filter(r=>Number(r.EJECUCION_PERIODO)>0);
 if(/incompleta/.test(text))rows=rows.filter(r=>String(r.SITUACIONES).includes('Información incompleta'));
 if(/persistente/.test(text))rows=rows.filter(r=>Number(r.PERSISTENCIA)>=2);
 if(/baja mg/.test(text))rows=rows.filter(r=>r.PCT_META_REFERENCIA!=null).sort((a,b)=>Number(a.PCT_META_REFERENCIA)-Number(b.PCT_META_REFERENCIA));
 if(/antigu|rezagad/.test(text))rows=rows.filter(r=>r.ANTIGUEDAD_MESES!=null).sort((a,b)=>Number(b.ANTIGUEDAD_MESES)-Number(a.ANTIGUEDAD_MESES));
 if(alert&&!why){rows=rows.filter(reserveFlag);e.state.analyticSituation='alerta';}
 if(prior)e.state.analyticSituation='prioridad';
 if(why&&!ent.codes.length&&!e.context.codEp&&e.state.lastResultCodEps?.length){const selected=new Set(e.state.lastResultCodEps);rows=rows.filter(r=>selected.has(String(r.COD_EP)));}
 e.state.analyticMetric=metric;
 const columns=['COD_EP','EPS','ODS','REGION','T_EPS','CONEXIONES','RECONOCIDO_PR','RECONOCIDO_AVANCE','EJECUCION_PERIODO','SALDO','ANIO_EVALUADO','PCT_EJECUCION_ACUMULADA','EJECUCION_PR','EJECUCION_TOTAL','PCT_AVANCE_PR','SALDO_CONEXION','EJECUCION_1000','RECONOCIDO_CONEXION','SITUACIONES','ALERTA_SUNASS','POSICION_AT','MOTIVO_AT',...(e.context.reserva==='MERESE'?['CUENCAS','AREA_INTERES_HA','EJECUCION_HA']:[])];
 if(prior&&/top \d+/.test(text))rows=rows.slice(0,Number(text.match(/top (\d+)/)![1]));
 if(why||prior)return make(rows,prior?'Priorización de Asistencia Técnica':'Motivo de seguimiento',columns);
 if(/cuantas|cuantos/.test(text))return make([{EPS:rows.length,UNIVERSO:members.length}],'Conteo de EPS');
 if(/resumen|resume/.test(text))return members.length===1?make(rows,'Resumen EPS',columns):make([analyticSummary(rows,[e.context.ods,e.context.region,e.context.size].filter(Boolean).join(' · ')||'Perú')],'Estado integral de reservas');
 if(/evolucion/.test(text)){const codes=members.map(i=>i.COD_EP);return /reconocido|aprobado/.test(text)?make(recognizedTimeline(e.finances??{},codes,from,to),'Evolución del reconocido del PR vigente',undefined,'Estimación según el PR vigente; no reconstruye PR anteriores.'):make(reserveTimeline(e.finances??{},codes,from,to,'annual').map(r=>({ANIO:r.period,EJECUCION_PERIODO:r.execution,SALDO:r.balance})),'Evolución anual');}
 if(/situaciones? de seguimiento/.test(text))return make(rows,'Situaciones de seguimiento',columns);
 if(/cuanto saldo|cuanto.*reconocido|cuanto.*aprobado/.test(text)){const result=make(rows,'Detalle del total disponible',columns);const total=analyticSummary(rows,'Ámbito seleccionado')[metric];result.result.summary='Total disponible: '+(typeof total==='number'?'S/ '+total.toLocaleString('en-US',{maximumFractionDigits:1}):'—')+'. '+rows.length+' EPS; los faltantes no equivalen a cero.';return result;}
 if(/top|mayor|menor|mas|ranking|orden|saldo elevado/.test(text)&&!compare){const asc=/menor|menos|baja/.test(text);rows=rows.filter(r=>r[metric]!=null).sort((a,b)=>(Number(a[metric])-Number(b[metric]))*(asc?1:-1)||Number(a.COD_EP)-Number(b.COD_EP));const n=text.match(/(?:top|las) (\d+)/)?.[1];if(n)rows=rows.slice(0,Number(n));else if(/que eps|cual|quien/.test(text))rows=rows.slice(0,1);return make(rows,'Ranking '+metric,Array.from(new Set(['COD_EP','EPS','ODS','REGION','T_EPS',metric,...columns])));}
 if(compare||alert||/muestrame|eps|valor estimado|ejecucion pr|ejecucion total|indicadores normalizados|cuencas/.test(text))return make(rows,alert?'Alerta SUNASS':'Consulta de EPS',columns);
 if(/conexion|hectarea|\bha\b|interes hidrico/.test(text))return make(rows,'Indicador comparativo',Array.from(new Set(['COD_EP','EPS','REGION','T_EPS',metric,...columns])));
 return make([analyticSummary(rows,'Ámbito seleccionado')],'Estado de reservas');
}

// Explicit regulatory questions share the dashboard annual source and completed-year rule.
function annualReserves(text:string,e:Environment):{plan:Plan;result:QueryResult}|undefined{
 const official=/meta de gestion|meta oficial|\bmg\b/.test(text),match=text.match(/ano(?: regulatorio)?\s*(\d+)/),year=match?Number(match[1]):undefined;
 if(!official&&!/ejecucion acumulada|porcentaje de ejecucion|%.*ejecucion|ejecucion.*%|evolucion por ano regulatorio/.test(text)&&!(year&&/estimacion|recaudacion|ejecucion/.test(text)))return;
 if(/alerta|saldo.*(?:mill|1mm)/.test(text))return;
 const members=e.institutions.filter(i=>!e.context.scopeCodes||e.context.scopeCodes.includes(i.COD_EP));
 const rows:QueryResult['rows']=[];
 for(const i of members){const f=e.finances?.[i.COD_EP],evaluated=completedYear(f),ys=/evolucion|histori/.test(text)?Array.from({length:evaluated??0},(_,n)=>n+1):[year??evaluated];for(const y of ys){const c=y?cumulativeYear(f,y):{estimate:null,execution:null,percent:null},a=annualSource(f),applicable=y!=null&&y>=1&&y<=Math.min(f?.regulatorio?.DURACION_PR??0,5);const base={COD_EP:i.COD_EP,EPS:i.EP,ODS:i.ODS,ANIO_REGULATORIO_VIGENTE:f?.regulatorio?.ANIO_REGULATORIO_VIGENTE??f?.regulatorio?.anio_vigente??null,ANIO_EVALUADO:y};if(official){rows.push({...base,META_GESTION_OFICIAL:y?f?.regulatorio?.meta_gestion?.[y-1]??null:regulatoryValue(f).value});}else rows.push({...base,ESTIMACION_ANUAL:applicable?a?.estimacion_anual[y!-1]??null:null,EJECUCION_ANUAL:applicable&&evaluated!=null&&y!<=evaluated?a?.ejecucion_anual[y!-1]??null:null,ESTIMACION_ACUMULADA:c.estimate,EJECUCION_ACUMULADA:c.execution,PCT_EJECUCION_ACUMULADA:c.percent});}}
 const plan:Plan={intent:'consultaReservasAcumulada',level:e.context.codEp?'eps':e.context.ods?'ods':'national',codes:members.map(i=>i.COD_EP),ods:[],period:{desde:e.context.desde,hasta:e.context.hasta},latestBalance:false,conditions:[],metric:'EJECUCION_MERESE',sort:'desc',positiveExecution:false,physical:{},summary:false,count:false,range:false,followUp:false,output:'table',confidence:1,original:text};
 return {plan,result:{title:official?'Meta de Gestión oficial (trazabilidad)':'Ejecución según Año Regulatorio Evaluado',description:official?'Fuente oficial Q:U / AF:AJ. No gobierna la Alerta SUNASS ni la priorización AT.':'Ejeseparado: anual distinto de acumulado. Año evaluado = mínimo(AR vigente − 1, duración PR, 5). Faltantes y denominadores no positivos: —.',columns:Object.keys(rows[0]??{}),rows,summary:rows.length+' registros',metadata:{reserva:e.context.reserva}}};
}

function calendarReserves(text:string,e:Environment):{plan:Plan;result:QueryResult}|undefined{
 const years=[...new Set(text.match(/\b202[1-6]\b/g)??[])];if(!years.length||/ano regulatorio/.test(text)||!/saldo|ejecu/.test(text))return;
 const balance=/saldo/.test(text),members=e.institutions.filter(i=>!e.context.scopeCodes||e.context.scopeCodes.includes(i.COD_EP));
 let rows=calendarHistory(e.finances??{},members,e.context.hasta??'',balance?'balance':'execution');
 if(years.length===1&&/top|mayor|menor|mas|menos/.test(text)){const year=years[0],ascending=/menor|menos/.test(text);rows=rows.filter(r=>typeof r[year]==='number').sort((a,b)=>(Number(a[year])-Number(b[year]))*(ascending?1:-1)||Number(a.COD_EP)-Number(b.COD_EP));const top=text.match(/top (\d+)/)?.[1];if(top)rows=rows.slice(0,Number(top));else if(/que eps|cual/.test(text))rows=rows.slice(0,1);}
 const plan:Plan={intent:'consultaReservasCalendario',level:e.context.codEp?'eps':e.context.ods?'ods':'national',codes:members.map(i=>i.COD_EP),ods:e.context.ods?[e.context.ods]:[],period:{hasta:e.context.hasta},latestBalance:false,conditions:[],metric:balance?'SALDO':'EJECUCION_MERESE',sort:'desc',positiveExecution:false,physical:{},summary:false,count:false,range:false,followUp:false,output:'table',confidence:1,original:text};
 const columns=['EPS',...years];return {plan,result:{title:(balance?'Saldo':'Ejecución')+' por año calendario · '+years.join(' / '),description:balance?'Implementacion: último saldo válido del mismo año (diciembre si existe). Sin arrastre entre años. Cero no equivale a ausencia.':'Implementacion: suma de ejecución ocurrida en cada año calendario, al corte disponible. No son años regulatorios ni acumulados entre años.',columns,rows:rows.map(r=>Object.fromEntries(['COD_EP',...columns].map(k=>[k,r[k]]))),summary:rows.length+' EPS',metadata:{hasta:e.context.hasta,reserva:e.context.reserva}}};
}
