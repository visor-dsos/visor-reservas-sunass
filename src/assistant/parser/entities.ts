import type {Institution} from '../../mereseQueryEngine';
import {normalizeText} from './normalizeText';
import {Clarification} from './types';
const phrase=(text:string,name:string)=>(' '+text+' ').includes(' '+name+' ');
const short=(s:string)=>normalizeText(s).replace(/^(eps |empresa prestadora )/,'').replace(/\s+s\s*(?:a|r\s*l)\s*$/,'').trim();
const cache=new WeakMap<Institution[],ReturnType<typeof build>>();
function build(institutions:Institution[]){return {ods:[...new Set(institutions.map(i=>i.ODS))],aliases:institutions.map(i=>({i,names:[normalizeText(i.EP),short(i.EP)]})),codes:new Map(institutions.map(i=>[i.COD_EP,i]))};}
function distance(a:string,b:string){if(Math.abs(a.length-b.length)>1)return 2;const d=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const old=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return d[b.length];}
export function entities(text:string,institutions:Institution[],contextCode?:string){
 let index=cache.get(institutions);if(!index){index=build(institutions);cache.set(institutions,index);}
 const codes=new Set<string>();let remainder=text;
 for(const m of text.matchAll(/\b(?:cod_ep|cod ep|codigo eps|eps)\s*(\d{1,3})\b/g)){if(!index.codes.has(m[1]))throw new Clarification('No encuentro ese COD_EP en el catálogo institucional.');codes.add(m[1]);remainder=remainder.replace(m[0],' ');}
 // Exact official names first; then longest aliases. Ambiguous short forms
 // are resolved only by an explicitly selected candidate, never a fixed EPS.
 const choose=(name:string,candidates:typeof index.aliases)=>{
  const unique=[...new Map(candidates.map(a=>[a.i.COD_EP,a])).values()];
  const selected=unique.find(a=>a.i.COD_EP===contextCode);
  if(unique.length>1&&!selected)throw new Clarification('Encontré más de una EPS relacionada con “'+name+'”: '+unique.map(a=>a.i.EP+' (COD_EP '+a.i.COD_EP+')').join('; ')+'. Precisa cuál deseas consultar.');
  return (unique.length===1?unique[0]:selected)!.i.COD_EP;
 };
 for(const a of [...index.aliases].sort((a,b)=>b.names[0].length-a.names[0].length))if(phrase(remainder,a.names[0])){
  codes.add(choose(a.names[0],index.aliases.filter(b=>b.names[0]===a.names[0])));remainder=remainder.replace(a.names[0],' ');
 }
 const names=[...new Set(index.aliases.map(a=>a.names[1]))].sort((a,b)=>b.length-a.length);
 for(const name of names)if(phrase(remainder,name)){
  const candidates=index.aliases.filter(a=>a.names[1]===name||a.names[1].startsWith(name+' '));
  codes.add(choose(name,candidates));remainder=remainder.replace(name,' ');
 }
 for(const token of remainder.split(' ').filter(w=>w.length>=6)){
  const candidates=index.aliases.filter(a=>a.names.some(n=>!n.includes(' ')&&distance(token,n)<=1));
  if(candidates.length>1)throw new Clarification('Encontré más de una coincidencia. ¿Te refieres a: '+candidates.map(c=>c.i.EP).join(' o ')+'?');
  if(candidates.length===1){codes.add(candidates[0].i.COD_EP);remainder=remainder.replace(token,' ');}
 }
 const ods=index.ods.filter(o=>phrase(remainder,normalizeText(o)));
 const explicitOds=remainder.match(/\bods (?:de )?([a-z]+)/)?.[1];
 if(!ods.length&&explicitOds&&!['esta','actual','con','que','tienen','tiene','por','sin','ejecuto','ejecutaron'].includes(explicitOds)){
  const candidates=index.ods.filter(o=>normalizeText(o).length>=5&&distance(explicitOds,normalizeText(o))<=1);
  if(candidates.length===1)ods.push(candidates[0]);else if(candidates.length>1)throw new Clarification('¿Qué ODS deseas consultar: '+candidates.join(' o ')+'?');
 }
 return {codes:[...codes],ods};
}
