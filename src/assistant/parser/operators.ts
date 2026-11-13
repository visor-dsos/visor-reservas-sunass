import {amountPattern,parseAmount} from './amounts';
import {Clarification,type Condition,type Metric} from './types';
export const metricMatches=(s:string)=>[...s.matchAll(/ejecucion|ejecut\w*|gasto|saldo\w*|fondos? disponibles?|monto disponible|hectareas?|\bha\b|area|superficie|kilometros?|\bkm\b|longitud|intervenciones/g)].map(m=>({index:m.index!,end:m.index!+m[0].length,metric:(/saldo|fondo|disponible/.test(m[0])?'SALDO':/hectarea|^ha$|area|superficie/.test(m[0])?'AREA_HA':/kilometro|^km$|longitud/.test(m[0])?'LONGITUD_KM':m[0]==='intervenciones'?'INTERVENCIONES':'EJECUCION_MERESE') as Metric}));
export function operators(text:string,fallback:Metric){
 const metrics=metricMatches(text),conditions:Condition[]=[],covered:[number,number][]=[];
 const metricFor=(start:number,end:number):Metric=>{
  const unit=text.slice(end).match(/^\s*(hectareas?|ha|kilometros?|km|intervenciones)\b/);
  if(unit)return /hectarea|^ha$/.test(unit[1])?'AREA_HA':/km|kilometro/.test(unit[1])?'LONGITUD_KM':'INTERVENCIONES';
  return metrics.filter(m=>m.index<start).at(-1)?.metric??metrics.find(m=>m.index>=end)?.metric??fallback;
 };
 const range=new RegExp('entre (?:soles )?('+amountPattern+') (?:soles )?y (?:soles )?('+amountPattern+')','g');
 for(const m of text.matchAll(range)){
  const a=parseAmount(m[1]),b=parseAmount(m[2]);if(a>=1900&&a<=2100&&b>=1900&&b<=2100&&!/soles|mil/.test(m[0]))continue;
  if(a>b)throw new Clarification('El monto mínimo supera al máximo.');const metric=metricFor(m.index!,m.index!+m[0].length);conditions.push({metric,op:'gte',value:a},{metric,op:'lte',value:b});covered.push([m.index!,m.index!+m[0].length]);
 }
 const rex=new RegExp('(>=|<=|>|<|=|al menos|como maximo|mayor(?:es)?(?: que| a)?|mas de|superior(?:es)?(?: a)?|por encima(?: de)?|menor(?:es)?(?: que| a| de)?|menos de|inferior(?:es)?(?: a)?|por debajo(?: de)?|igual(?: a)?)\\s*(?:soles )?('+amountPattern+')','g');
 for(const m of text.matchAll(rex)){if(covered.some(([a,b])=>m.index!>=a&&m.index!<b))continue;const op:Condition['op']=/^(>=|al menos)/.test(m[1])?'gte':/^(<=|como maximo)/.test(m[1])?'lte':/^(<|menor|menos|inferior|por debajo)/.test(m[1])?'lt':/^(=|igual)/.test(m[1])?'eq':'gt';conditions.push({metric:metricFor(m.index!,m.index!+m[0].length),op,value:parseAmount(m[2])});}
 if(/no ejecut\w*|sin ejecucion|ejecucion (?:cero|0)\b/.test(text))conditions.push({metric:'EJECUCION_MERESE',op:'eq',value:0});
 if(/sin intervenciones|no (?:tiene|tienen) intervenciones/.test(text))conditions.push({metric:'INTERVENCIONES',op:'eq',value:0});
 else if(/(?:con|tengan|tienen|tiene) intervenciones/.test(text))conditions.push({metric:'INTERVENCIONES',op:'gt',value:0});
 if(conditions.some(c=>!Number.isFinite(c.value)))throw new Clarification('No pude interpretar el monto.');
 if(!conditions.length&&/saldo alto|baja ejecucion|mucho saldo|poca ejecucion|saldo bajo|ejecucion alta/.test(text))throw new Clarification('¿Qué umbral deseas utilizar?');
 if(!conditions.length&&/(?:ejecucion|saldo)\s+(?:soles\s+)?(?![12][09]\d{2}\b)\d/.test(text))throw new Clarification('¿Qué comparación deseas utilizar para ese monto: mayor, menor o igual?');
 return conditions;
}
