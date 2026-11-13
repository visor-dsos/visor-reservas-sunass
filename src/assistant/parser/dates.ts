import {Clarification,type Period} from './types';
const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const aliases=months.flatMap((m,i)=>[[m,i+1],[m.slice(0,3),i+1]] as [string,number][]).concat([['setiembre',9],['set',9]]);
const monthMap=new Map(aliases),monthPattern='(?:'+[...monthMap.keys()].join('|')+')';
const date=(year:string,month:number)=>year+'-'+String(month).padStart(2,'0');
export function dates(text:string):Period&{explicit:boolean;latest:boolean}{
 const latest=/ultimo corte|ultima fecha|mas reciente/.test(text);let desde:string|undefined,hasta:string|undefined;
 const semester=text.match(/(primer|segundo) semestre (?:de )?((?:19|20)\d{2})/);
 const shared=text.match(new RegExp('(?:de|desde|entre) ('+monthPattern+') (?:a|y|hasta) ('+monthPattern+') (?:de )?((?:19|20)\\d{2})'));
 const hits=[...text.matchAll(new RegExp('('+monthPattern+') (?:de )?((?:19|20)\\d{2})','g'))];
 const iso=[...text.matchAll(/\b((?:19|20)\d{2})-(\d{2})\b/g)];
 const years=[...text.matchAll(/\b((?:19|20)\d{2})\b/g)].map(m=>m[1]);
 if(semester){desde=date(semester[2],semester[1]==='primer'?1:7);hasta=date(semester[2],semester[1]==='primer'?6:12);}
 else if(shared){desde=date(shared[3],monthMap.get(shared[1])!);hasta=date(shared[3],monthMap.get(shared[2])!);}
 else if(iso.length){if(iso.some(m=>Number(m[2])<1||Number(m[2])>12))throw new Clarification('El mes indicado no es válido.');desde=iso[0][0];hasta=iso.at(-1)![0];}
 else if(hits.length>=2){desde=date(hits[0][2],monthMap.get(hits[0][1])!);hasta=date(hits.at(-1)![2],monthMap.get(hits.at(-1)![1])!);}
 else if(hits.length===1){const m=hits[0],d=date(m[2],monthMap.get(m[1])!);if(years.length>1&&years[0]!==m[2]){desde=date(years[0],1);hasta=d;}else if(/\bhasta\b|al cierre|al corte/.test(text)){hasta=d;}else if(/\bdesde\b/.test(text)){desde=d;}else{desde=d;hasta=d;}}
 else if(years.length>=2){desde=date(years[0],1);hasta=date(years.at(-1)!,12);}
 else if(years.length===1){if(/\bhasta\b/.test(text))hasta=date(years[0],12);else if(/\bdesde\b/.test(text))desde=date(years[0],1);else{desde=date(years[0],1);hasta=date(years[0],12);}}
 if(desde&&hasta&&desde>hasta)throw new Clarification('El periodo está invertido. Indica Desde anterior o igual a Hasta.');
 return {desde,hasta,explicit:!!(desde||hasta),latest};
}
