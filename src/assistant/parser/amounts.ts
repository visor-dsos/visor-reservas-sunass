import {numberWords} from './lexicon';
export const amountPattern='(?:medio millon|(?:\\d[\\d.,]*|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)(?:\\s+(?:millones|millon|mil))?(?:\\s+y medio)?)';
export function parseAmount(input:string):number{
 const s=input.replace(/soles/g,'').trim();if(s==='medio millon')return 500000;
 const raw=s.match(/^(\d[\d.,]*|[a-z]+)/)?.[0]??'';
 let n=numberWords[raw];
 if(n==null){let v=raw;if(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(v))v=v.replaceAll(',','');else if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(v))v=v.replaceAll('.','').replace(',','.');else v=v.replace(',','.');n=Number(v);}
 const scale=/millon/.test(s)?1000000:/\bmil\b/.test(s)?1000:1;
 return (n+(/y medio/.test(s)?.5:0))*scale;
}
