// Public location configuration only. Never place credentials in VITE_*.
export const runtimeMode=true;
export const runtimeCurrentUrl=(import.meta.env.DEV?'/data/runtime-reservas/current.json':'/runtime/current.json');
let pointerRequest:Promise<any>|undefined;
export function runtimePointer(){return pointerRequest??=readPointer()}
async function readPointer(){
 const url=new URL(runtimeCurrentUrl,location.origin);url.searchParams.set('t',String(Date.now()));
 const response=await fetch(url,{cache:'no-store'});if(response.status===404)return null;
 if(!response.ok)throw Error('No se pudo cargar current.json');
 const p=await response.json(),base=new URL(p.base,url);
 if(p.status!=='validated'||!/^\d{8}T\d{6}Z_[a-f0-9]{8}$/.test(p.version)||base.origin!==url.origin||!base.pathname.endsWith('/versions/'+p.version+'/')||!['http:','https:'].includes(base.protocol))throw Error('Manifest runtime no vÃ¡lido');
 return {...p,base:base.href};
}
