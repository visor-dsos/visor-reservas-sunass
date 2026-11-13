import {readFile,mkdir,cp,rename,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const source=process.argv[2];
if(!source)throw Error('Uso: node scripts/actualizar-datos.mjs carpeta-version');
const load=async n=>JSON.parse(await readFile(join(source,n),'utf8'));
const [meta,financial,master,context]=await Promise.all([load('manifest.json'),load('finanzas_eps.json'),load('maestro_eps.json'),readFile('public/data/reservas/contexto.json','utf8').then(JSON.parse)]);
if(!/^\d{8}T\d{6}Z_[a-f0-9]{8}$/.test(meta.version)||meta.status!=='validated'||!Number.isFinite(Date.parse(meta.updated_at)))throw Error('Versión/fecha/validación inválida');
const codes=context.institutions.map(i=>String(i.COD_EP)).sort();
for(const data of [financial.eps,master.eps])if(JSON.stringify(Object.keys(data??{}).sort())!==JSON.stringify(codes))throw Error('El conjunto de COD_EP no coincide con las 50 EPS institucionales');
for(const f of Object.values(financial.eps)){if(!Array.isArray(f.implementacion))throw Error('Implementacion no válida');for(const row of [...f.implementacion,...(f.implementacion_grd_acc??[])])for(const k of ['saldo','ejecucion'])if(row[k]!==null&&(typeof row[k]!=='number'||!Number.isFinite(row[k])))throw Error('Importe no numérico: conservar null, no convertir a cero');}
const root=resolve('public/data/runtime-reservas'),dest=join(root,'versions',meta.version),staging=dest+'.tmp';
try{await access(dest);throw Error('La versión ya existe: no se sobrescribe')}catch(e){if(e.code!=='ENOENT')throw e}
await mkdir(staging,{recursive:true});
for(const n of ['finanzas_eps.json','maestro_eps.json'])await cp(join(source,n),join(staging,n));
await rename(staging,dest);
const {writeFile}=await import('node:fs/promises');
const pointer={version:meta.version,financial_version:meta.version,master_version:meta.version,status:'validated',updated_by:'admin',updated_at:meta.updated_at,base:'/data/runtime-reservas/versions/'+meta.version+'/'};
await writeFile(join(root,'current.next.json'),JSON.stringify(pointer,null,2));
await rename(join(root,'current.next.json'),join(root,'current.json'));
console.log('Versión local activada:',meta.version,'; publicar únicamente en el repositorio nuevo.');
