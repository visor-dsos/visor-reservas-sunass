import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import ReservasDashboard from './ReservasDashboard';
import content from './reservasInstitutionalContent.json';
import logo from './assets/logo-sunass-oficial.png';
import './ReservasInstitutional.css';
const preference='reservas_sunass_bienvenida_v1';
function accepted(){try{return localStorage.getItem(preference)==='1'}catch{return false}}
function inline(text:string):ReactNode{return text.split(/(\*\*.*?\*\*)/g).map((part,i)=>part.startsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part)}
function Text({value}:{value:string}){return <>{value.split(/\n\s*\n/).map((block,i)=>{
 if(block==='---')return <hr key={i}/>;
 const h=block.match(/^(#{1,3}) (.*)$/);if(h)return h[1].length===1?<h1 key={i} tabIndex={-1}>{h[2]}</h1>:h[1].length===2?<h2 key={i}>{h[2]}</h2>:<h3 key={i}>{h[2]}</h3>;
 if(block.startsWith('- '))return <ul key={i}>{block.split('\n').map((line,n)=><li key={n}>{inline(line.replace(/^- /,''))}</li>)}</ul>;
 return <p key={i} className={/^\*\*0[1-5]\./.test(block)?'institutional-component':undefined}>{inline(block)}</p>;
 })}</>}
const parts=content.about.split(/^## /m), sections=parts.slice(1).map(part=>({title:part.slice(0,part.indexOf('\n')),body:part.slice(part.indexOf('\n')+1)}));
export default function ReservasInstitutional(){
 const [view,setView]=useState<'welcome'|'about'|'dashboard'>(()=>accepted()?'dashboard':'welcome');
 const surface=useRef<HTMLElement>(null),dashboard=useRef<HTMLDivElement>(null),returnFocus=useRef<HTMLElement|null>(null),scroll=useRef(0),initial=useRef(true);
 useLayoutEffect(()=>{if(view!=='dashboard'){surface.current?.scrollTo(0,0);surface.current?.querySelector<HTMLElement>('h1')?.focus()}else if(!initial.current){if(returnFocus.current){window.scrollTo(0,scroll.current);returnFocus.current.focus({preventScroll:true})}else {const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));target?.scrollIntoView();dashboard.current?.querySelector<HTMLElement>('h1')?.setAttribute('tabindex','-1');(target??dashboard.current?.querySelector<HTMLElement>('h1'))?.focus({preventScroll:true})}}initial.current=false},[view]);
 function enter(){try{localStorage.setItem(preference,'1')}catch{/* Access remains available without storage. */}setView('dashboard')}
 function open(){returnFocus.current=document.activeElement as HTMLElement;scroll.current=window.scrollY;setView('welcome')}
 return <><div ref={dashboard} hidden={view!=='dashboard'}><ReservasDashboard onAbout={open}/></div>{view!=='dashboard'&&<main className="institutional-screen" ref={surface}>
 <div className="institutional-shell"><header className="institutional-brand"><img src={logo} alt="Sunass"/></header>
 <div className="institutional-actions"><button className="institutional-primary" onClick={enter}>Entendido, ingresar al visor</button>{view==='welcome'?<button onClick={()=>setView('about')}>Ver información completa</button>:<button onClick={()=>setView('welcome')}>Volver a la presentación</button>}</div>
 {view==='welcome'?<article className="institutional-welcome"><Text value={content.welcome}/></article>:<article className="institutional-about"><Text value={parts[0]}/><nav aria-label="Índice de información del visor">{sections.map((s,i)=><button key={s.title} onClick={()=>{const el=document.getElementById('institutional-section-'+i) as HTMLDetailsElement;el.open=true;el.scrollIntoView({block:'start'});el.querySelector('summary')?.focus({preventScroll:true})}}>{s.title}</button>)}</nav>{sections.map((s,i)=><details key={s.title} id={'institutional-section-'+i}><summary>{s.title}</summary><Text value={s.body}/></details>)}</article>}
 <footer><button className="institutional-primary" onClick={enter}>Entendido, ingresar al visor</button></footer></div></main>}</>;
}
