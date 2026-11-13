import type {Finance} from '../../interventionIndicators';
// Percentage points, never currency. No qualitative threshold is assumed.
export const regulatoryRules={maximumYear:5,lowThreshold:null as number|null};
export function referenceYear(year:number|null|undefined){return year!=null&&Number.isInteger(year)&&year>=1?Math.min(Math.max(year-1,1),regulatoryRules.maximumYear):null;}
export function regulatoryValue(finance:Finance|undefined,year?:number){
 const r=finance?.regulatorio,ref=referenceYear(r?.anio_vigente),requested=year??ref;
 return {vigente:r?.anio_vigente??null,reference:ref,year:requested,value:requested!=null&&ref!=null&&requested>=1&&requested<=ref?r?.meta_gestion?.[requested-1]??null:null,applicable:requested!=null&&ref!=null&&requested>=1&&requested<=ref,note:r?.anio_vigente===1?'Año 1: referencia disponible; no representa un año cerrado.':'Referencia del último año regulatorio cerrado, con máximo de cinco.'};
}
