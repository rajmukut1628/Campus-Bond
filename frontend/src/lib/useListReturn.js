import {useRef,useEffect} from "react";
import {readListPosition,saveListPosition} from "./listNavigation.js";
export function useListReturn(key,values,ready) {
  const root=useRef(null), latest=useRef(values), loaded=useRef(ready);
  const target=useRef(readListPosition(key));
  latest.current=values;loaded.current=ready;
  useEffect(()=>{
    const element=root.current;
    const remember=()=>{
      if(!loaded.current)return;
      saveListPosition(key,{values:latest.current,scroll:window.scrollY,inner:element?.querySelector('[data-return-scroll]')?.scrollTop || 0});
    };
    window.addEventListener("scroll",remember,{passive:true});element?.addEventListener("scroll",remember,true);element?.addEventListener("click",remember,true);
    return()=>{window.removeEventListener("scroll",remember);element?.removeEventListener("scroll",remember,true);element?.removeEventListener("click",remember,true);};
  },[key]);
  useEffect(()=>{
    if(!ready || !target.current)return;
    const frame=requestAnimationFrame(()=>{const saved=target.current;window.scrollTo({top:saved.scroll,behavior:"instant"});const inner=root.current?.querySelector('[data-return-scroll]');if(inner)inner.scrollTop=saved.inner || 0;target.current=null;});
    return()=>cancelAnimationFrame(frame);
  },[ready,key]);
  return root;
}
