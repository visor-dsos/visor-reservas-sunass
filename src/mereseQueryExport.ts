import type {QueryResult} from './mereseQueryEngine';
const safeText=(s:string)=>/^[=+\-@\t\r]/.test(s)?"'"+s:s;
export async function downloadQuery(r:QueryResult,format:'csv'|'xlsx'){
 const name=(r.title.startsWith('GRD')?'GRD_ACC_':'MERESE_')+r.title.replace(/[^a-zA-Z0-9]/g,'_')+'_'+(r.metadata.desde??'')+'_'+(r.metadata.hasta??'');
 const values=r.rows.map(row=>r.columns.map(c=>row[c]??null));let blob:Blob;
 if(format==='xlsx'){const XLSX=await import('xlsx');const sheet=XLSX.utils.aoa_to_sheet([r.columns,...values]);r.columns.forEach((c,index)=>{if(/^PCT_|SALDO|EJECUCION_MERESE|ESTIMACION$/.test(c))for(let row=1;row<=values.length;row++){const cell=sheet[XLSX.utils.encode_cell({r:row,c:index})];if(cell?.t==='n')cell.z=c.startsWith('PCT_')?'0.0" %"':'"S/ "#,##0.00'}});sheet['!cols']=r.columns.map(c=>({wch:c==='EPS'?38:24}));const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Consulta');blob=new Blob([XLSX.write(book,{bookType:'xlsx',type:'array'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 }else{const quote=(v:unknown)=>'"'+(typeof v==='string'?safeText(v):v==null?'':String(v)).replace(/"/g,'""')+'"';blob=new Blob(['\ufeff'+[r.columns,...values].map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name+'.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
