import {lexicon,has,numberWords} from './lexicon';
import {entities} from './entities';
import {dates} from './dates';
import {metricMatches,operators} from './operators';
import {classify} from './intentClassifier';
import {Clarification,type Environment,type Plan,type Metric} from './types';
export function extract(text:string,original:string,e:Environment):Plan{
 const previous=e.state.lastQueryPlan,followUp=has(text,lexicon.follow)||/de ellas|de ellos/.test(text)||/^(?:ordena|grafica|descarga|exporta)/.test(text);
 const action=has(text,lexicon.export)?(/csv/.test(text)?'csv':'xlsx'):has(text,lexicon.graph)?'chart':'table';
 const ent=entities(text,e.institutions,e.context.codEp),d=dates(text),metrics=metricMatches(text);
 const orderPart=text.match(/(?:orden\w*|orden) .*?(?:por|segun|menor|mayor) (.*)/)?.[1];
 const sortMetric=orderPart?metricMatches(orderPart).at(-1)?.metric:undefined;
 const metric:Metric=sortMetric??metrics[0]?.metric??(followUp?previous?.metric:undefined)??'EJECUCION_MERESE';
 const physicalOnly=has(text,lexicon.area)||has(text,lexicon.length)||/ejecucion fisica/.test(text);
 const interventionQuestion=has(text,lexicon.interventions)&&!has(text,lexicon.eps)&&!physicalOnly&&!has(text,lexicon.execution)&&!has(text,lexicon.balance)&&!/^eps\b/.test(text);
 let level:Plan['level']=interventionQuestion?'interventions':has(text,lexicon.ods)&&!has(text,lexicon.eps)?'ods':'eps';
 if(followUp&&previous)level=previous.level;
 if(!followUp&&ent.ods.length&&!ent.codes.length&&!has(text,lexicon.eps)&&!interventionQuestion)level='ods';
 if(/nacional|\bperu\b|todo el pais/.test(text)||has(text,lexicon.total)&&!ent.codes.length&&!ent.ods.length&&!/esta eps|esta ods/.test(text))level='national';
 const codes=ent.codes.slice(),ods=ent.ods.slice();
 if(/esta eps|esta empresa|esta prestadora|\bella\b|\bsu saldo\b/.test(text)&&!codes.length){if(!e.context.codEp)throw new Clarification('Selecciona una EPS o indica su nombre o COD_EP.');codes.push(e.context.codEp);}
 if(/esta ods|esta oficina/.test(text)&&!ods.length){if(!e.context.ods)throw new Clarification('Selecciona una ODS o indica su nombre.');ods.push(e.context.ods);}
 if(!codes.length&&!ods.length&&/\bactual\b/.test(text)){if(e.context.codEp)codes.push(e.context.codEp);else if(e.context.ods)ods.push(e.context.ods);}
 const conditions=operators(text,metric);
 const numbers='(?:\\d+|'+Object.keys(numberWords).join('|')+')';
 const countMatch=text.match(new RegExp('(?:top|las|los|primeras|primeros) ('+numbers+')\\b'));
 let limit=countMatch?(numberWords[countMatch[1]]??Number(countMatch[1])):undefined;
 if(limit==null&&/\b(?:cual es la eps|la eps con|que eps tiene|cual eps|que ods|cual ejecuto|cual tiene|cual de ellas tiene|cual de ellos tiene)\b/.test(text)&&/mayor|menor|mas|menos/.test(text))limit=1;
 if(limit!=null&&(!Number.isInteger(limit)||limit<1||limit>1000))throw new Clarification('Indica un límite entre 1 y 1000.');
 const ascending=has(text,lexicon.asc)||(!has(text,lexicon.desc)&&!conditions.length&&/menor|menos|ultimas/.test(text));
 const period={desde:d.desde??(followUp?previous?.period.desde:undefined)??e.context.desde,hasta:d.hasta??(followUp?previous?.period.hasta:undefined)??e.context.hasta};
 if(d.explicit){if(d.desde&&!d.hasta&&period.hasta&&d.desde>period.hasta)period.hasta=undefined;if(d.hasta&&!d.desde&&period.desde&&d.hasta<period.desde)period.desde=undefined;}
 if(/situacion|ultimo corte/.test(text)&&!d.explicit){period.desde=undefined;period.hasta=undefined;}
 const balanceLatest=d.latest&&has(text,lexicon.balance);
 const p:Plan={intent:'',level,codes,ods,period,balanceUntil:balanceLatest?undefined:period.hasta,latestBalance:balanceLatest,conditions,metric,sort:ascending?'asc':'desc',limit,positiveExecution:/ejecutaron|ejecutado|ejecutadas/.test(text)&&!conditions.some(c=>c.metric==='EJECUCION_MERESE'),physical:{},summary:has(text,lexicon.summary)||/situacion/.test(text),count:/cuantas|cuantos|conteo|numero de/.test(text)&&!physicalOnly,range:has(text,lexicon.range),followUp,output:action,confidence:.95,original};
 if(interventionQuestion&&!d.explicit)p.period={};
 if(interventionQuestion||physicalOnly||conditions.some(c=>c.metric==='INTERVENCIONES')){
  const all=e.engine.listarIntervenciones({}).rows;
  for(const [key,col] of [['tipoIntervencion','TIPO_INTERVENCION'],['descripcion','DESCRIPCION']] as const){for(const value of new Set(all.map(r=>String(r[col])))){if((' '+text+' ').includes(' '+value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()+' '))p.physical[key]=value;}}
  if(/fuera/.test(text))p.physical.relacionCuenca='Fuera';else if(/intersect|cruzan/.test(text))p.physical.relacionCuenca='Intersecta';else if(/dentro/.test(text))p.physical.relacionCuenca='Dentro';
  if(interventionQuestion&&d.desde&&d.desde?.slice(0,4)===d.hasta?.slice(0,4))p.physical.anio=Number(d.desde?.slice(0,4));
  const code=text.match(/\b\d+-i\d+\b/);if(code)p.physical.codigo=code[0].toUpperCase();
  if(/esta eps|esta ods|este periodo/.test(text)){p.physical.descripcion??=e.context.descripcion;p.physical.anio??=e.context.anio;p.physical.codigo??=e.context.codigo;}
 }
 if(followUp&&!previous&&!['xlsx','csv'].includes(action))throw new Clarification('Primero realiza una consulta para poder usar su resultado.');
 if(followUp&&previous){
  if(!codes.length)p.codes=e.state.lastResultCodEps?.slice()??[];
  if(!ods.length)p.ods=previous.ods.slice();
  if(!d.explicit)p.period={...previous.period};
  if(!sortMetric&&!metrics.length)p.metric=previous.metric;
  if(!ascending&&!/mayor a menor|descendente/.test(text))p.sort=previous.sort;
  // Seguimiento opera sobre el conjunto anterior: no vuelve a aplicar umbrales de otro periodo.
  p.conditions=conditions;
  p.physical={...previous.physical,...p.physical};
 }
 if(has(text,lexicon.compare)&&p.codes.length<2&&p.ods.length<2){if(/estas|esas|anteriores/.test(text)&&e.state.lastResultCodEps?.length){p.codes=e.state.lastResultCodEps.slice();}else throw new Clarification('¿Qué EPS u ODS deseas comparar?');}
 const recognized=has(text,lexicon.interventions)||metrics.length||p.summary||p.range||p.codes.length||p.ods.length||has(text,lexicon.eps)||has(text,lexicon.ods)||action!=='table'||followUp||has(text,lexicon.compare);
 if(!recognized)throw new Clarification('No pude identificar la consulta. Indica ejecución, saldo, EPS, ODS o intervenciones y el periodo que deseas.');
 if(/\beps [a-z]/.test(text)&&!codes.length&&!ods.length&&!has(text,lexicon.execution)&&!has(text,lexicon.balance)&&!has(text,lexicon.ranking)&&!p.summary&&!p.count&&!p.conditions.length&&!p.range&&!followUp)throw new Clarification('No encuentro esa EPS. Indica su nombre oficial o COD_EP.');
 if(/\bods\b/.test(text)&&!ods.length&&!has(text,lexicon.execution)&&!has(text,lexicon.balance)&&!p.range&&!p.summary&&!p.count&&!followUp)throw new Clarification('No encuentro esa ODS en el catálogo.');
 p.intent=classify(p,text);return p;
}
