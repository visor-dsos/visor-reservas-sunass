import {useEffect,useRef,useState} from 'react';
import type {Finance} from './interventionIndicators';
import type {Institution} from './mereseQueryEngine';
import type {ReserveContextData} from './reserveAnalytics';
import type {Reserve} from './reserveSelection';
export default function ReserveFichaDialog({institutions,finances,context,reserve,selected,end,onClose}:{institutions:Institution[];finances:Record<string,Finance>;context:ReserveContextData;reserve:Reserve;selected:string;end:string;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[code,setCode]=useState(selected),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{dialog.current?.showModal()},[]);
 const download=async()=>{if(!institutions.some(i=>i.COD_EP===code))return;setBusy(true);setError('');try{const {downloadReserveFicha}=await import('./reserveFicha');await downloadReserveFicha({institutions,finances,context,reserve,code,end});}catch{setError('No se pudo generar la ficha completa. Intente nuevamente.')}finally{setBusy(false)}};
 return <dialog ref={dialog} className="reserve-ficha-dialog" aria-label="Seleccione EPS" onCancel={onClose}><h2>Seleccione EPS</h2><label>EPS<select aria-label="EPS para ficha" value={code} onChange={e=>setCode(e.target.value)} disabled={busy}><option value="">Seleccione una EPS</option>{institutions.map(i=><option key={i.COD_EP} value={i.COD_EP}>{i.EP}</option>)}</select></label><div className="reserve-controls"><button disabled={!code||busy} onClick={download}>{busy?'Generando ficha…':'Descargar Word'}</button><button disabled={busy} onClick={onClose}>Cerrar</button></div>{error&&<p role="alert">{error}</p>}</dialog>;
}
