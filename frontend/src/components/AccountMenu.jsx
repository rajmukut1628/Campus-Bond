import React, { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, UserRound, Settings, LogOut } from "lucide-react";
import { api, Avatar, useAuth, errorText } from "./ui.jsx";

export function AccountMenu() {
  const {user,setUser}=useAuth();
  const location=useLocation();
  const [open,setOpen]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState("");
  const root=useRef(null), trigger=useRef(null), panel=useRef(null), submitting=useRef(false);
  const panelId=useId();
  const role={student:"Student",alumni:"Alumni",admin:"Administrator",superadmin:"Super Admin"}[user.role];
  useEffect(()=>{setOpen(false);setError("");},[location.key]);
  useEffect(()=>{
    if(!open)return;
    panel.current?.querySelector("a")?.focus();
    const outside=event=>{if(!root.current?.contains(event.target) && !submitting.current)setOpen(false);};
    const keyboard=event=>{
      if(event.key==="Escape" && !submitting.current){event.preventDefault();setOpen(false);trigger.current?.focus();}
    };
    const focus=event=>{if(!root.current?.contains(event.target) && !submitting.current)setOpen(false);};
    document.addEventListener("pointerdown",outside);
    document.addEventListener("keydown",keyboard);
    document.addEventListener("focusin",focus);
    return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",keyboard);document.removeEventListener("focusin",focus);};
  },[open]);
  return <div className="account-menu" ref={root}>
    <button type="button" className="account-menu-trigger" ref={trigger} aria-label="Account menu" aria-expanded={open} aria-controls={panelId} disabled={busy} onClick={()=>setOpen(value=>!value)} onKeyDown={event=>{if(event.key==="ArrowDown"){event.preventDefault();setOpen(true);}}}>
      <Avatar user={user}/><ChevronDown size={13} aria-hidden="true"/>
    </button>
    {open && <div className="account-menu-panel" id={panelId} ref={panel}>
      <div className="account-menu-identity"><Avatar user={user}/><div><strong>{user.name}</strong><span>{role}</span></div></div>
      <nav aria-label="Account actions">
        <Link to="/app/profile"><UserRound size={17}/><span>Profile</span></Link>
        <Link to="/app/settings"><Settings size={17}/><span>Settings</span></Link>
        <button className="account-menu-logout" type="button" disabled={busy} aria-busy={busy} onClick={async()=>{
          if(submitting.current)return;
          submitting.current=true;setBusy(true);setError("");
          try{await api.post("/auth/logout");setUser(null);window.location.replace("/");}
          catch(e){setError(errorText(e));submitting.current=false;setBusy(false);}
        }}><LogOut size={17}/><span>{busy ? "Logging out…" : "Logout"}</span></button>
      </nav>
      {error && <p className="account-menu-error" role="alert">{error}</p>}
    </div>}
  </div>;
}
