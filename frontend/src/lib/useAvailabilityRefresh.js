import {useEffect,useRef,useState} from 'react';
// Refresh server state without clearing content, and update at date boundaries.
export function useAvailabilityRefresh(reload, ...dates) {
  const latest=useRef(reload),[tick,setTick]=useState(0);
  latest.current=reload;
  const next=dates.map(value=>new Date(value).getTime()).filter(value=>Number.isFinite(value)&&value>Date.now()).sort((a,b)=>a-b)[0];
  useEffect(()=>{
    if(!next)return;
    const timer=setTimeout(()=>{setTick(value=>value+1);latest.current();},Math.min(Math.max(1,next-Date.now()+1),2147483647));
    return()=>clearTimeout(timer);
  },[next,tick]);
  useEffect(()=>{
    const refresh=()=>{if(!document.hidden)latest.current();};
    const timer=setInterval(refresh,20000);
    document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);};
  },[]);
}
