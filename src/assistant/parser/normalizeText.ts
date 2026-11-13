import {spelling} from './lexicon';
export function normalizeText(text:string){
 let s=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/s\s*\/|\bsoles?\b/g,' soles ').replace(/[¿?¡!;:()"“”]/g,' ').replace(/\.(?!\d)/g,' ').replace(/,(?!\d)/g,' ').replace(/\s+/g,' ');
 for(const [from,to] of Object.entries(spelling))s=s.replace(new RegExp('\\b'+from+'\\b','g'),to);
 return s.trim();
}
