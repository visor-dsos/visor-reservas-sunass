import {entities} from './entities';
import {normalizeText} from './normalizeText';
import {numberWords} from './lexicon';
import {extract} from './slotExtractor';
import {executePlan} from './queryPlanner';
import {Clarification,type Environment,type Plan} from './types';
import type {Cell,QueryResult} from '../../mereseQueryEngine';
type Row=Record<string,Cell>;
const numeric=(v:Cell|undefined):v is number=>typeof v==='number'&&Number.isFinite(v);
const sum=(r:Row[],c:string)=>{const v=r.map(x=>x[c]).filter(numeric);return v.length?v.reduce((a,b)=>a+b,0):null;};
function result(p:Plan,rows:Row[],columns?:string[],chart?:string):QueryResult{return {title:'Consulta analítica MERESE',description:'Cálculos locales sobre los resultados del motor existente; faltantes distintos de cero.',rows,columns:columns??Object.keys(rows[0]??{}),summary:`${rows.length} registro(s).`,metadata:{intent:p.intent,desde:p.period.desde,hasta:p.period.hasta,corteSaldo:p.balanceUntil},chart};}
function base(text:string,e:Environment){return extract(text,text,e);}
function finish(p:Plan,rows:Row[],metric:string){rows.sort((a,b)=>!numeric(a[metric])?1:!numeric(b[metric])?-1:(Number(a[metric])-Number(b[metric]))*(p.sort==='asc'?1:-1));if(p.limit)rows=rows.slice(0,p.limit);return {plan:p,result:result(p,rows,undefined,metric)};}
function periods(text:string){const years=[...text.matchAll(/\b(20\d{2})\b/g)].map(m=>m[1]);if(years.length!==2)throw new Clarification('Indica dos años para comparar, por ejemplo 2024 contra 2025.');let [a,b]=years;if(/20\d{2}\s+(?:respecto|frente)\s+(?:a\s+)?20\d{2}/.test(text))[a,b]=[b,a];return [{desde:a+'-01',hasta:a+'-12'},{desde:b+'-01',hasta:b+'-12'}];}
export function analytics(text:string,e:Environment):{plan:Plan;result:QueryResult}|undefined{
 const prev=e.state.lastQueryPlan,last=e.state.lastResult;
 text=text.replace(/\b(las|los) (tres|cinco|dos|cuatro|seis|diez) (primeras|primeros|ultimas|ultimos)\b/g,(_,article,n,position)=>`${article} ${position} ${numberWords[n]}`);
 // Operations on a displayed result retain precisely that set and its order.
 if(/posicion|posiciones|segunda|segundo|ultimas? \d|ultimos? \d|primeras? \d|primeros? \d/.test(text)&&last&&/de es|de las|de los|posicion|segunda|segundo|solo|muestra|dame/.test(text)){
  const p={...prev!,intent:'seleccionPosicional'},r=text.match(/posiciones?\s*(\d+)\s*(?:a|al|hasta|y|-)\s*(\d+)/),n=Number(text.match(/(?:primeras?|primeros?|ultimas?|ultimos?)\s*(\d+)/)?.[1]??1);let rows=r?last.rows.slice(Number(r[1])-1,Number(r[2])):/segunda|segundo/.test(text)?last.rows.slice(1,2):/ultim/.test(text)?last.rows.slice(-n):last.rows.slice(0,n);p.limit=rows.length;return {plan:p,result:{...last,rows,summary:`${rows.length} registros del resultado anterior.`,metadata:{...last.metadata,intent:p.intent}}};
 }
 if(!last&&/promedio|mediana/.test(text)){
  const p=base(text,e),r=executePlan({...p,limit:undefined,count:false},e);return analytics(text,{...e,state:{...e.state,lastQueryPlan:p,lastResult:r}});
 }
 if(last&&/cuanto suman|suma de (?:esas|estas|las anteriores)|suma las|acumulado de|promedio|mediana/.test(text)){
  const p={...prev!,intent:'acumuladoTopN'},metric=/saldo/.test(text)?'SALDO':prev!.metric,values=last.rows.map(r=>r[metric]).filter(numeric).sort((a,b)=>a-b);let value=sum(last.rows,metric);
  if(/promedio/.test(text))value=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  if(/mediana/.test(text))value=values.length?(values[Math.floor((values.length-1)/2)]+values[Math.floor(values.length/2)])/2:null;
  return {plan:p,result:result(p,[{OPERACION:/mediana/.test(text)?'Mediana':/promedio/.test(text)?'Promedio':'Suma',REGISTROS_VALIDOS:values.length,[metric]:value}])};
 }
 if(last&&/solo (?:dame )?(?:los )?nombres|solo (?:dame )?(?:eps|columnas)|muestrame codigo|quita (?:la columna |el )?|agrega (?:la columna|el saldo|area)|incluye (?:la columna|el saldo)/.test(text)){
  const p={...prev!,intent:'salidaPersonalizada'};let rows=last.rows,cols=last.columns.slice();
  const wanted=[/codigo/.test(text)?'COD_EP':'EPS',...(/ejecucion/.test(text)?['EJECUCION_MERESE']:[]),...(/saldo/.test(text)?['SALDO']:[])];
  if(/^solo|muestra solo|muestrame codigo/.test(text))cols=wanted;
  else if(/quita/.test(text))cols=cols.filter(c=>!(/saldo/.test(text)&&c==='SALDO'||/ods/.test(text)&&c==='ODS'));
  else if(/saldo|area/.test(text)){const field=/area/.test(text)?'AREA_HA':'SALDO',q=executePlan({...prev!,codes:e.state.lastResultCodEps??[],summary:true,limit:undefined},e);rows=rows.map(r=>({...r,[field]:q.rows.find(s=>s.COD_EP===r.COD_EP)?.[field]??null}));cols=[...new Set([...cols,field])];}
  return {plan:p,result:{...last,rows,columns:cols,metadata:{...last.metadata,intent:p.intent}}};
 }
 const variation=/variacion|aumento|aumentaron|aument[oó]|redujeron|redujo|disminuy|increment/.test(text),comparison=/compara.*(?:20\d{2}).*(?:20\d{2})/.test(text);
 if(variation||comparison){
  const pp=periods(text),ent=entities(text,e.institutions,e.context.codEp),p=base('ejecucion '+text.replace(/20\d{2}/g,'').replace(/compara/g,''),e);p.codes=ent.codes;p.ods=ent.ods;p.level=ent.ods.length&&!ent.codes.length&&!/eps/.test(text)?'ods':'eps';p.limit=/que eps.*mas|cual.*mas/.test(text)?1:p.limit;p.sort=/redu|disminuy/.test(text)?'asc':'desc';p.intent=comparison?p.level==='ods'?'compararPeriodosODS':'compararPeriodosEPS':p.limit||!p.codes.length?'rankingVariacionEjecucion':'variacionEjecucionEPS';
  const get=(period:Plan['period'])=>executePlan({...p,period,balanceUntil:period.hasta,limit:undefined,positiveExecution:false,conditions:[],summary:false,count:false},e).rows;
  const a=get(pp[0]),b=get(pp[1]),key=p.level==='ods'?'ODS':'COD_EP';let rows=a.map(r=>{const v1=r.EJECUCION_MERESE,v2=b.find(s=>s[key]===r[key])?.EJECUCION_MERESE,d=numeric(v1)&&numeric(v2)?v2-v1:null;return {COD_EP:r.COD_EP??null,EPS:r.EPS??null,ODS:r.ODS,PERIODO_1:pp[0].desde.slice(0,4),PERIODO_2:pp[1].desde.slice(0,4),EJECUCION_1:v1,EJECUCION_2:v2??null,VARIACION:d,PCT_VARIACION:numeric(d)&&numeric(v1)&&v1>0?d/v1*100:null};});
  if(/redu|disminuy/.test(text))rows=rows.filter(r=>numeric(r.VARIACION)&&r.VARIACION<0);
  return finish(p,rows,'VARIACION');
 }
 if(/tendencia|evolucion|por ano|por mes|ano.*mas ejecu|ano.*mayor ejecu|ano ejecuto mas/.test(text)){
  const p=base('ejecucion '+text,e);p.intent='tendenciaEjecucionEPS';const range=e.engine.obtenerRangoPeriodo(p.codes.length===1?{codEp:p.codes[0]}:p.ods.length===1?{ods:p.ods[0]}:{});const monthly=/mensual|por mes/.test(text),rows:Row[]=[];
  if(range.desde&&range.hasta){for(let y=Number(range.desde.slice(0,4));y<=Number(range.hasta.slice(0,4));y++){for(let m=1;m<=(monthly?12:1);m++){const from=monthly?`${y}-${String(m).padStart(2,'0')}`:`${y}-01`,to=monthly?from:`${y}-12`;if(to<range.desde||from>range.hasta)continue;const rr=executePlan({...p,period:{desde:from,hasta:to},limit:undefined,conditions:[],count:false,positiveExecution:false},e);rows.push({PERIODO:monthly?from:String(y),EJECUCION_MERESE:sum(rr.rows,'EJECUCION_MERESE')});}}}
  if(/mas|mayor/.test(text)){p.limit=1;return finish(p,rows,'EJECUCION_MERESE');}
  const r=result(p,rows,undefined,'EJECUCION_MERESE');r.metadata.ordenTemporal='sí';return {plan:p,result:r};
 }
 if(/participacion|porcentaje.*ejecucion nacional|porcentaje.*(?:corresponde|representa)|que parte.*ejecucion/.test(text)){
  const p=base('ejecucion '+text.replace(/nacional/g,''),e);if(p.codes.length)p.level='eps';p.intent=p.level==='ods'?'participacionEjecucionODS':'participacionEjecucionEPS';const parent=/dentro de|en su ods|de su ods/.test(text)&&p.codes.length?e.institutions.find(i=>i.COD_EP===p.codes[0])?.ODS:undefined;
  const denominator=executePlan({...p,level:'eps',codes:[],ods:parent?[parent]:[],conditions:[],limit:undefined,count:false,positiveExecution:false},e),total=sum(denominator.rows,'EJECUCION_MERESE');const r=executePlan({...p,limit:undefined},e);return {plan:p,result:result(p,r.rows.map(row=>({...row,AMBITO_REFERENCIA:parent??'Perú',EJECUCION_REFERENCIA:total,PCT_PARTICIPACION:numeric(row.EJECUCION_MERESE)&&numeric(total)&&total>0?row.EJECUCION_MERESE/total*100:null})),undefined,'PCT_PARTICIPACION')};
 }
 if(/diferencia.*saldo|saldo.*menos.*ejecucion|mas saldo que ejecucion|ratio|relacion.*ejecucion.*saldo|ejecucion.*respecto.*saldo/.test(text)){
  const p=base('ejecucion '+text.replace(/^ordena /,''),e);p.intent=/ratio|respecto|relacion/.test(text)?'ratioEjecucionSaldo':'diferenciaSaldoEjecucion';const r=executePlan({...p,summary:true},e),rows=r.rows.map(row=>({...row,DIFERENCIA_SALDO_EJECUCION:numeric(row.SALDO)&&numeric(row.EJECUCION_MERESE)?row.SALDO-row.EJECUCION_MERESE:null,PCT_RATIO_EJECUCION_SALDO:numeric(row.SALDO)&&row.SALDO>0&&numeric(row.EJECUCION_MERESE)?row.EJECUCION_MERESE/row.SALDO*100:null}));return finish(p,/mas saldo que ejecucion/.test(text)?rows.filter(r=>numeric(r.DIFERENCIA_SALDO_EJECUCION)&&r.DIFERENCIA_SALDO_EJECUCION>0):rows,p.intent==='ratioEjecucionSaldo'?'PCT_RATIO_EJECUCION_SALDO':'DIFERENCIA_SALDO_EJECUCION');
 }
 if(/primer reporte|desde cuando|datos desde|informacion desde|disponibilidad|fecha minima|fecha maxima|hasta que fecha/.test(text)&&!/desde su primer reporte/.test(text)){
  const p=base('resumen '+text,e);p.intent=p.level==='ods'?'disponibilidadDatosODS':'disponibilidadDatosEPS';let rows:Row[]=e.institutions.filter(i=>(!p.codes.length||p.codes.includes(i.COD_EP))&&(!p.ods.length||p.ods.includes(i.ODS))).map(i=>{const r=e.engine.obtenerRangoPeriodo({codEp:i.COD_EP});return {COD_EP:i.COD_EP,EPS:i.EP,ODS:i.ODS,DESDE:r.desde??null,HASTA:r.hasta??null};});const year=text.match(/(?:datos|informacion) desde (20\d{2})/)?.[1];if(year)rows=rows.filter(r=>typeof r.DESDE==='string'&&r.DESDE<=year+'-12');if(p.level==='ods')rows=[...new Set(rows.map(r=>r.ODS))].map(ods=>{const group=rows.filter(r=>r.ODS===ods);return {ODS:ods,DESDE:group.map(r=>r.DESDE).filter(v=>v!=null).sort()[0]??null,HASTA:group.map(r=>r.HASTA).filter(v=>v!=null).sort().at(-1)??null};});return {plan:p,result:result(p,rows)};
 }
 const excluded=text.match(/(?:excepto|excluyendo|excluye|excluir|sin incluir|sin(?! (?:ejecucion|intervenciones|lineas|puntos|poligonos|datos))|menos(?! de)(?: a)?)\s+(.+?)(?=\s+(?:con |y (?:saldo|ejecucion)|orden|que )|$)/),relative=text.match(/ultimos?\s+(\d+|tres|seis|doce)\s+(meses|anos)/),geometry=/poligonos|lineas|puntos/.test(text);
 if(excluded||relative||geometry||/desde su primer reporte/.test(text)||entities(text,e.institutions,e.context.codEp).ods.length>1||entities(text,e.institutions,e.context.codEp).codes.length>1){
  const clean=excluded?text.replace(excluded[0],''):text,p=base(geometry?(/eps/.test(clean)?'ejecucion ':'intervenciones ')+clean:clean,e);let excludedCodes:string[]=[],excludedOds:string[]=[];
  if(excluded){const ent=entities(excluded[1],e.institutions,e.context.codEp);excludedCodes=ent.codes;excludedOds=ent.ods;if(!excludedCodes.length&&!excludedOds.length)throw new Clarification('No identifico la EPS u ODS que deseas excluir.');p.intent=excludedCodes.length?'excluirEPS':'excluirODS';e.state.exclusions={excludeOds:excludedOds,excludeCodEps:excludedCodes};}
  else p.intent=geometry?'crucesFisicoFinancierosAvanzados':p.ods.length>1?'filtroMultiplesODS':p.codes.length>1?'filtroMultiplesEPS':p.intent;
  if(relative){const range=e.engine.obtenerRangoPeriodo(p.codes.length===1?{codEp:p.codes[0]}:p.ods.length===1?{ods:p.ods[0]}:{}),n=Number(relative[1])||({tres:3,seis:6,doce:12} as Record<string,number>)[relative[1]],months=n*(relative[2]==='anos'?12:1);if(range.hasta){const [y,m]=range.hasta.split('-').map(Number),d=new Date(Date.UTC(y,m-months,1));p.period={desde:d.toISOString().slice(0,7),hasta:range.hasta};p.balanceUntil=range.hasta;}}
  if(/desde su primer reporte/.test(text)){p.period.desde=e.engine.obtenerRangoPeriodo(p.codes.length===1?{codEp:p.codes[0]}:{}).desde;}
  const r=executePlan({...p,limit:undefined,count:false},e);let rows=r.rows.filter(row=>!excludedCodes.includes(String(row.COD_EP))&&!excludedOds.includes(String(row.ODS)));
  if(geometry){const ints=e.engine.listarIntervenciones(p.physical).rows;const is=(r:Row,name:string)=>normalizeText(String(r.TIPO_GEOMETRIA??'')).includes(name);const scopeCodes=/sus intervenciones/.test(text)?e.state.lastResultCodEps??[]:p.codes;const selected=ints.filter(r=>!scopeCodes.length||scopeCodes.includes(String(r.COD_EP))).filter(r=>!p.ods.length||p.ods.includes(String(r.ODS)));
   if(/porcentaje|%/.test(text)){const total=selected.length,n=selected.filter(r=>is(r,'poligono')).length;return {plan:p,result:result(p,[{INTERVENCIONES:total,POLIGONOS:n,PCT_POLIGONOS:total?n/total*100:null}])};}
   const names=[['poligonos','poligono'],['lineas','linea'],['puntos','punto']];rows=rows.filter(row=>names.every(([word,type])=>!text.includes(word)||new RegExp('sin '+word).test(text)?!text.includes(word)||!(p.level==='interventions'?is(row,type):ints.some(i=>i.COD_EP===row.COD_EP&&is(i,type))):(p.level==='interventions'?is(row,type):ints.some(i=>i.COD_EP===row.COD_EP&&is(i,type)))));
  }
  if(p.limit)rows=rows.slice(0,p.limit);if(p.count)rows=[{[p.level==='interventions'?'INTERVENCIONES':'EPS']:rows.length}];return {plan:p,result:{...r,rows,columns:p.count?[p.level==='interventions'?'INTERVENCIONES':'EPS']:r.columns,summary:`${rows.length} registro(s).`,metadata:{...r.metadata,intent:p.intent}}};
 }
}
