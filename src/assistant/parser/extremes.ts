import type {QueryResult} from '../../mereseQueryEngine';
export type Extreme={operation:'extreme'|'ranking';metric:string;direction:'max'|'min';position?:number;limit?:number};
export function selectExtreme(rows:QueryResult['rows'],q:Extreme){
 const sorted=rows.filter(r=>typeof r[q.metric]==='number'&&Number.isFinite(r[q.metric])).slice().sort((a,b)=>(Number(a[q.metric])-Number(b[q.metric]))*(q.direction==='min'?1:-1)||String(a.COD_EP).localeCompare(String(b.COD_EP)));
 // Dense ranks: equal values share a position. Top-N retains boundary ties.
 if(q.position||q.operation==='extreme'){const values=[...new Set(sorted.map(r=>r[q.metric]))],v=values[(q.position??1)-1];return sorted.filter(r=>v!==undefined&&r[q.metric]===v);}
 if(!q.limit||sorted.length<=q.limit)return sorted;const boundary=Number(sorted[q.limit-1][q.metric]);return sorted.filter(r=>q.direction==='max'?Number(r[q.metric])>=boundary:Number(r[q.metric])<=boundary);
}
