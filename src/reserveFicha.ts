import {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,HeadingLevel,ImageRun} from 'docx';
import {createMereseQueryEngine,type Institution} from './mereseQueryEngine';
import type {Finance} from './interventionIndicators';
import {analyticRows,type ReserveContextData} from './reserveAnalytics';
import {reserveEstimates,reservePercent} from './reserveMonitoring';
import {reserveLabel,type Reserve} from './reserveSelection';
import {interventionBase} from './interventionData';
type Input={institutions:Institution[];finances:Record<string,Finance>;context:ReserveContextData;reserve:Reserve;code:string;end:string};
const text=(v:unknown)=>v==null?'No disponible':String(v);
const money=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?'S/ '+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'No disponible';
const p=(s:string)=>new Paragraph({text:s,spacing:{after:100}});
const h=(s:string)=>new Paragraph({text:s,heading:HeadingLevel.HEADING_1,keepNext:true,spacing:{before:180,after:100}});
const table=(rows:string[][])=>new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:rows.map(r=>new TableRow({cantSplit:true,children:r.map((s,i)=>new TableCell({margins:{top:80,bottom:80,left:100,right:100},shading:{fill:i===0?'EDF6FC':'FFFFFF'},children:[new Paragraph({children:[new TextRun({text:s,bold:i===0,size:21})],spacing:{after:60}})]}))}))});
export async function createReserveFicha(x:Input){
 const i=x.institutions.find(i=>i.COD_EP===x.code);if(!i)throw Error('COD_EP no reconocido');
 const f=x.finances[x.code],start=f?.implementacion?.[0]?.fecha?.slice(0,7)??'',engine=createMereseQueryEngine(x.finances,x.institutions,[]),r=analyticRows(engine,x.finances,[i],start,x.end,x.reserve,x.context)[0],program=reserveEstimates(f),theme=reserveLabel(x.reserve);
 const title='Ficha de seguimiento de reservas '+theme;
 const body:(Paragraph|Table)[]=[p('SUNASS'),new Paragraph({text:title,heading:HeadingLevel.TITLE}),p(i.EP),p('Información financiera y regulatoria de la EPS para la reserva seleccionada.'),h('Identificación'),table([['EPS',i.EP],['COD_EP',i.COD_EP],['ODS',i.ODS],['Reserva',theme]]),h('Resumen financiero'),table([['Ejecución histórica total',money(r.EJECUCION_TOTAL)],['Saldo bancario vigente',money(r.SALDO)],['Fecha del último saldo válido',text(r.FECHA_ULTIMO_SALDO)],['Ejecución del PR vigente',money(r.EJECUCION_PR)],['Monto programado a ejecutar del PR vigente',money(program.total)]]),h('Información regulatoria'),table([['Fecha de inicio del PR',text(r.FECHA_INICIO_PR)],['Duración del PR (años)',text(r.DURACION_PR)],['Año regulatorio vigente',text(r.ANIO_REGULATORIO_VIGENTE)],['Año regulatorio evaluado',text(r.ANIO_EVALUADO)],['Ejecución acumulada regulatoria',r.PCT_EJECUCION_ACUMULADA==null?'No disponible':reservePercent(r.PCT_EJECUCION_ACUMULADA)],['Avance global del PR',r.PCT_AVANCE_PR==null?'No disponible':reservePercent(r.PCT_AVANCE_PR)]])];
 let photoCount=0;
 if(x.reserve==='MERESE'){
  const base=await interventionBase();const responses=await Promise.all([fetch(base+'intervenciones_catalogo.json'),fetch('/data/intervention-photos/manifest.json')]);if(responses.some(r=>!r.ok))throw Error('Catálogo fotográfico no disponible');
  const [catalog,manifest]=await Promise.all(responses.map(r=>r.json()));const used=new Set<string>();
  for(const item of catalog.intervenciones.filter((item:{COD_EP:string})=>String(item.COD_EP)===x.code)){
   for(const photo of manifest.interventions[item.COD_INTERVENCION]??[]){if(used.has(photo.src)||!/^\/data\/intervention-photos\/[a-f0-9]{16}\.webp$/.test(photo.src))continue;used.add(photo.src);
    const response=await fetch(photo.src);if(!response.ok)throw Error('Fotografía no disponible');const bitmap=await createImageBitmap(await response.blob());const canvas=document.createElement('canvas');const ratio=Math.min(1,1400/bitmap.width,1000/bitmap.height);canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error()),'image/jpeg',.9));
    if(!photoCount)body.push(new Paragraph({text:'Intervenciones MERESE',heading:HeadingLevel.HEADING_1,pageBreakBefore:true,keepNext:true}));
    body.push(new Paragraph({text:String(item.COD_INTERVENCION)+' · '+text(item.DESCRIPCION??item.TIPO_INTERVENCION)+' · Año / periodo: '+text(item.ANIO_NORMALIZADO??item.PERIODO??item['AÑO']),keepNext:true,spacing:{before:160,after:80}}));const scale=Math.min(500/canvas.width,300/canvas.height);body.push(new Paragraph({children:[new ImageRun({type:'jpg',data:new Uint8Array(await blob.arrayBuffer()),transformation:{width:Math.round(canvas.width*scale),height:Math.round(canvas.height*scale)}})],spacing:{after:160}}));photoCount++;if(photoCount===3)break;
   }if(photoCount===3)break;
  }
 }
 body.push(h('Fuentes y referencia'),p('Reportes Regulatorios DRE-SUNASS. Reserva: '+theme+'. Periodo histórico: '+start+' – '+x.end+'. Corte consultado: '+x.end+'.'),p('Programación del PR vigente: Ejeseparado. Importes y porcentajes obtenidos con las funciones financieras del visor; no son recaudación efectivamente percibida. Años regulatorios y calendario son bases temporales distintas.'),...(x.reserve==='GRD_ACC'?[p('V:Z se rotulan Programado Acumulado en la fuente. Se conserva el total y la metodología financiera vigente del visor.')]:photoCount?[p('Fotografías: módulo Intervenciones MERESE; vinculadas mediante COD_EP y código de intervención.')]:[]));
 return {photoCount,filename:'Ficha_'+x.reserve+'_'+x.code+'.docx',document:new Document({creator:'SUNASS',title,styles:{default:{document:{run:{font:'Calibri',size:22}}},paragraphStyles:[{id:'Title',name:'Title',basedOn:'Normal',run:{size:30,bold:true,color:'000000'}},{id:'Heading1',name:'Heading 1',basedOn:'Normal',run:{size:25,bold:true,color:'006EC7'}}]},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:850,bottom:850,left:850,right:850}}},children:body}]})};
}
export async function downloadReserveFicha(x:Input){const r=await createReserveFicha(x);const url=URL.createObjectURL(await Packer.toBlob(r.document));const a=document.createElement('a');a.href=url;a.download=r.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
