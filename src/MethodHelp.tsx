import {useId,useRef,useState} from 'react';
import './MethodHelp.css';
export function ATMethodHelp({text,label='Información metodológica'}:{text?:string;label?:string}={}){
 const [open,setOpen]=useState(false),[pos,setPos]=useState({left:16,top:16}),anchor=useRef<HTMLSpanElement>(null),id=useId();
 const show=()=>{const r=anchor.current?.getBoundingClientRect();if(r)setPos({left:Math.max(16,Math.min(r.left,window.innerWidth-436)),top:Math.max(16,Math.min(r.bottom+4,window.innerHeight-Math.min(420,window.innerHeight*.6)-16))});setOpen(true)};
 return <span ref={anchor} className="at-help" onMouseEnter={show} onMouseLeave={()=>setOpen(false)} onFocus={show} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false)}} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);e.stopPropagation()}}}>
  <button type="button" aria-label={label} aria-expanded={open} aria-controls={id} onClick={show}>ⓘ</button>
  {open&&<span id={id} role="tooltip" className="at-help-panel" style={pos}><span>{text}</span>
  </span>}
 </span>;
}
