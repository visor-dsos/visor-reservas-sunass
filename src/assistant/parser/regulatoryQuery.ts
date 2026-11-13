import {entities} from './entities';
import {regulatoryValue} from './regulatoryRules';
import {Clarification,type Environment,type Plan} from './types';
import type {QueryResult,Cell} from '../../mereseQueryEngine';
type Row=Record<string,Cell>;
export function regulatoryQuery(text:string,e:Environment):{plan:Plan;result:QueryResult}|undefined{
 if(/saldo|soles|dinero|monto/.test(text)&&!/meta|%|porcentaje/.test(text))return;
 const previous=e.state.lastQueryPlan,prior=previous?.intent&&/MetaGestion|Regulatori/.test(previous.intent);
 if(!/meta(?: de)? gestion|meta regulatoria|\bmeta\b|porcentaje de ejecucion|% (?:de )?ejecucion|ano regulatorio|resumen regulatorio|ejecucion %|ejecucion porcentual|eps.*estan.*ano \d/.test(text)&&!(prior&&/^(y |ahora |compara|el ano|ano |historico|su |cual es)/.test(text)))return;
 if(!e.finances)throw new Clarification('Los porcentajes regulatorios aún no están cargados.');
 if(/baj[oa]|alt[oa]|buen[oa]|mal[oa]|incumpl/.test(text)&&!/[<>\d]/.test(text))throw new Clarification('Indica el umbral porcentual para clasificar la Meta de Gestión; no hay un umbral cualitativo configurado.');
 const ent=entities(text,e.institutions,e.context.codEp);let codes=ent.codes,ods=ent.ods;
 if(/esta eps|su ejecucion|su %|sus porcentajes|su meta/.test(text)&&!codes.length){if(!e.context.codEp)throw new Clarification('Selecciona una EPS o indica COD_EP.');codes=[e.context.codEp];}
 if(prior&&!codes.length&&!ods.length&&/^(y |ahora |el ano|ano |historico|su |cual es|compara)/.test(text))codes=e.state.lastResultCodEps??previous!.codes;
 if(/compara.*(?:ambas|las)/.test(text)){codes=[...new Set([...(e.state.regulatoryCodes??[]),...codes])];}
 const vigente=/ano regulatorio|eps.*estan.*ano \d/.test(text)&&!/%|porcentaje|meta|historico/.test(text);
 const yearMatch=text.match(/(?:del? |al |en |para |el )?ano(?: regulatorio)?\s*(\d+)\b/),year=vigente?undefined:yearMatch?Number(yearMatch[1]):prior&&/^(y |ahora |el ano|ano |su |comparalas)/.test(text)?e.state.lastRegulatoryYear:undefined;
 if(year!=null&&(year<1||year>5))throw new Clarification('La Meta de Gestión dispone de años regulatorios 1 a 5.');
 const history=/historico|historia|todos los anos|todos los porcentajes|evolucion/.test(text),compare=/compar/.test(text),ranking=/top|ranking|mayor porcentaje|menor porcentaje|mejor/.test(text),count=/cuantas|cuantos|numero de/.test(text);
 if(compare&&codes.length<2)throw new Clarification('Indica al menos dos EPS para comparar su Meta de Gestión.');
 const between=text.match(/entre (\d+(?:[.,]\d+)?)\s*%? y (\d+(?:[.,]\d+)?)\s*%?/);
 const threshold=text.match(/(>=|<=|>|<|mayor(?:es)? (?:a|que)|mas de|super(?:a|an|aron|ior (?:a|al))|menor(?:es)? (?:a|que)|menos de|al menos|como maximo|igual a)\s*(?:el )?(\d+(?:[.,]\d+)?)\s*%?/);
 const target=threshold?Number(threshold[2].replace(',','.')):vigente?Number(yearMatch?.[1]):undefined;
 const meet=(v:Cell)=>typeof v==='number'&&(target==null||Number.isNaN(target)||!threshold?v===target||target==null||Number.isNaN(target):/^(>=|al menos)/.test(threshold[1])?v>=target:/^(<=|como maximo)/.test(threshold[1])?v<=target:/^(>|mayor|mas|super)/.test(threshold[1])?v>target:/^(<|menor|menos)/.test(threshold[1])?v<target:v===target);
 let rows:Row[]=[];
 for(const i of e.institutions.filter(i=>(!e.context.scopeCodes||e.context.scopeCodes.includes(i.COD_EP))&&(!codes.length||codes.includes(i.COD_EP))&&(!ods.length||ods.includes(i.ODS)))){
  const f=e.finances[i.COD_EP],r=regulatoryValue(f,year),base={COD_EP:i.COD_EP,EPS:i.EP,ODS:i.ODS,ANIO_REGULATORIO_VIGENTE:r.vigente,ANIO_META_GESTION_REFERENCIA:r.reference};
  if(compare){for(let a=1;a<=5;a++)Object.assign(base,{['PCT_ANIO_'+a]:regulatoryValue(f,a).value});}
  if(history){for(let a=1;a<=(r.reference??0);a++)rows.push({...base,ANIO_REGULATORIO:a,PCT_META_GESTION:regulatoryValue(f,a).value,NOTA:r.note});}
  else rows.push({...base,ANIO_REGULATORIO:r.year,PCT_META_GESTION:r.value,NOTA:r.applicable?r.note:'Año no aplicable a la referencia vigente o información no disponible.'});
 }
 const metric=vigente?'ANIO_REGULATORIO_VIGENTE':'PCT_META_GESTION';
 if(between)rows=rows.filter(r=>typeof r[metric]==='number'&&Number(r[metric])>=Number(between[1].replace(',','.'))&&Number(r[metric])<=Number(between[2].replace(',','.')));
 if(threshold||vigente&&target!=null&&!Number.isNaN(target))rows=rows.filter(r=>meet(r[metric]));
 const asc=/menor|ascendente/.test(text),limit=Number(text.match(/(?:top|primeras|primeros)\s*(\d+)/)?.[1])||(/que eps tiene mayor|cual.*mayor porcentaje/.test(text)?1:undefined);
 if(ranking)rows=rows.filter(r=>typeof r[metric]==='number').sort((a,b)=>(Number(a[metric])-Number(b[metric]))*(asc?1:-1));
 if(limit)rows=rows.slice(0,limit);
 const intent=history?'historicoMetaGestionEPS':compare?'compararMetaGestionEPS':vigente?(count||!codes.length?'epsPorAnioRegulatorio':'consultasRegulatorias'):/resumen regulatorio/.test(text)?'resumenRegulatorioEPS':ranking?year?'rankingMetaGestionPorAnio':'rankingMetaGestionReferencia':threshold||between?'filtrarMetaGestion':year?'porcentajeMetaGestionAnio':/referencia/.test(text)?'consultaMetaGestionReferencia':'porcentajeMetaGestionEPS';
 const plan:Plan={intent,level:'eps',codes,ods,period:{},latestBalance:false,conditions:[],metric:'EJECUCION_MERESE',sort:asc?'asc':'desc',limit,positiveExecution:false,physical:{},summary:true,count,range:false,followUp:!!prior,output:'table',confidence:1,original:text};
 e.state.lastRegulatoryYear=year;
 e.state.regulatoryCodes=[...new Set([...(e.state.regulatoryCodes??[]),...codes])].slice(-2);
 if(count)rows=[{EPS:rows.length}];
 const columns=count?['EPS']:vigente?['COD_EP','EPS','ODS','ANIO_REGULATORIO_VIGENTE','ANIO_META_GESTION_REFERENCIA']:['COD_EP','EPS','ODS','ANIO_REGULATORIO_VIGENTE','ANIO_META_GESTION_REFERENCIA','ANIO_REGULATORIO','PCT_META_GESTION',...(compare?['PCT_ANIO_1','PCT_ANIO_2','PCT_ANIO_3','PCT_ANIO_4','PCT_ANIO_5']:[]),'NOTA'];
 return {plan,result:{title:'Meta de Gestión',description:'Porcentajes de Ejecucion Q:U. No son importes monetarios ni un porcentaje de gasto calculado.',columns,rows,summary:`${rows.length} registro(s). Los años no aplicables y faltantes se mantienen como —.`,metadata:{intent,unidad:'puntos porcentuales',ordenTemporal:history?'sí':undefined},chart:!count&&rows.some(r=>typeof r[metric]==='number')?metric:undefined}};
}
