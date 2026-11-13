import type {Complement} from './reserveAnalytics';
// Only the two verified REGION cells from Benchmarking2026 2.xlsx (Hoja1, COD_EP).
// No R2 write, financial date change, or replacement of the remaining master fields.
export function correctMasterRegions<T extends {eps:Record<string,Complement>}>(master:T):T{
 const eps={...master.eps};
 for(const code of ['19','20'])if(eps[code]?.COD_EP===code&&eps[code].REGION==='Costa')eps[code]={...eps[code],REGION:'Selva'};
 return {...master,eps};
}
