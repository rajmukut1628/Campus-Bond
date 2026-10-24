import { fieldErrors as getFieldErrors } from "../lib/formErrors.js";
import { clearFeedPositions } from "../lib/feedNavigation.js";
import { BatchFormField } from "./BatchPicker.jsx";
import React, { createContext, useContext, useEffect, useState, useRef, useId } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Link,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";
import axios from "axios";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  MessagesSquare,
  BriefcaseBusiness,
  CalendarDays,
  HeartHandshake,
  Bell,
  Settings,
  LogOut,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  Check,
  ShieldCheck,
  Menu,
  X,
  ChevronRight,
  Globe,
  Send,
  MapPin,
  Clock,
  CheckCircle2,
  Network,
  Sparkles,
} from "lucide-react";

const api = axios.create({ baseURL: "/api/v1", withCredentials: true });
let csrfToken;
api.interceptors.request.use(async (config) => {
  if (!["get", "head", "options"].includes(config.method)) {
    if (!csrfToken) csrfToken = (await api.get("/csrf")).data.token;
    config.headers["X-CSRF-Token"] = csrfToken;
  }
  return config;
});
const Auth = createContext(null);
const useAuth = () => useContext(Auth);
const errorText = (e) =>
  e.response?.data?.errors
    ?.map((x) => `${x.field}: ${x.message}`)
    .join(" · ") ||
  e.response?.data?.message ||
  e.message ||
  "Request failed";
const admin = (u) => ["admin", "superadmin"].includes(u.role);
const date = (v) =>
  new Date(v).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
const money = (v) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(v);
function useLoad(url) {
  const [state,set]=useState({key:null,data:null,loading:true,refreshing:false,error:""});
  const [version,bump]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    set(previous=>previous.key === url && previous.data ? {...previous,loading:false,refreshing:true,error:""} : {key:url,data:null,loading:true,refreshing:false,error:""});
    api.get(url,{signal:controller.signal}).then(response=>{
      if(!controller.signal.aborted)set({key:url,data:response.data,loading:false,refreshing:false,error:""});
    }).catch(error=>{
      if(!controller.signal.aborted)set(previous=>({...previous,loading:false,refreshing:false,error:errorText(error)}));
    });
    return()=>controller.abort();
  },[url,version]);
  return {...(state.key === url ? state : {data:null,loading:true,refreshing:false,error:""}),reload:()=>bump(value=>value+1)};
}
function useDebounced(value,delay=300) {
  const [settled,setSettled]=useState(value);
  useEffect(()=>{const timer=setTimeout(()=>setSettled(value),delay);return()=>clearTimeout(timer);},[value,delay]);
  return settled;
}
function AuthProvider({ children }) {
  const [user, updateUser] = useState(null),
    [loading, setLoading] = useState(true);
  const setUser=value=>{if(value === null)clearFeedPositions();updateUser(value);};
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (r) => r,
      (e) => {
        if (e.response?.status === 401) setUser(null);
        return Promise.reject(e);
      },
    );
    return () => api.interceptors.response.eject(interceptor);
  }, []);
  useEffect(() => {
    api
      .get("/auth/me")
      .then((r) => setUser(r.data.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return (
    <Auth.Provider value={{ user, setUser, loading }}>{children}</Auth.Provider>
  );
}
function Avatar({ user, large = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [user?.avatar]);
  return (
    <span className={`avatar ${large ? "large" : ""}`}>
      {user?.avatar && !failed ? (
        <img
          src={user.avatar}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        (user?.name || "UC")
          .split(" ")
          .map((x) => x[0])
          .slice(0, 2)
          .join("")
      )}
    </span>
  );
}
function Status({ value }) {
  return <span className={`status ${value}`}>{value}</span>;
}
function Notice({ error, onRetry }) {
  return error ? (
    <div className="notice" role="alert">
      <span>{error}</span>{onRetry && <button type="button" onClick={onRetry}>Retry</button>}
    </div>
  ) : null;
}
function Loading() {
  return (
    <div className="empty" role="status">
      Loading your community…
    </div>
  );
}
function Empty({ children = "Nothing here yet. Check back soon." }) {
  return (
    <div className="empty">
      <Network size={30} />
      <p>{children}</p>
    </div>
  );
}
function Head({
  eyebrow = "YOUR UNIVERSITY, CONNECTED",
  title,
  description,
  children,
}) {
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
function Pager({ data, page, setPage, numbered = false }) {
  const pages = Math.max(1, data?.pages || 1);
  if (!data || (!numbered && pages <= 1) || (numbered && !data.total))
    return null;
  const values = [
    ...new Set([
      1,
      pages,
      ...Array.from({ length: 5 }, (_, i) => page + i - 2).filter(
        (n) => n >= 1 && n <= pages,
      ),
    ]),
  ].sort((a, b) => a - b);
  return (
    <nav className="pager" aria-label="Pagination">
      <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
        Previous
      </button>
      {numbered ? (
        <div className="page-numbers">
          {values.map((n, i) => (
            <React.Fragment key={n}>
              {i > 0 && n - values[i - 1] > 1 && (
                <span aria-hidden="true">…</span>
              )}
              <button
                aria-label={"Page " + n}
                aria-current={page === n ? "page" : undefined}
                className={page === n ? "primary" : ""}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            </React.Fragment>
          ))}
        </div>
      ) : (
        <span>
          {page} / {pages}
        </span>
      )}
      <button disabled={page >= pages} onClick={() => setPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}
function InputField(props) {
  const [show, setShow] = useState(false);
  if (props.type !== "password") return <input {...props} />;
  return (
    <span className="password-input">
      <input {...props} type={show ? "text" : "password"} />
      <button
        type="button"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        onClick={() => setShow(!show)}
      >
        {show ? "Hide" : "Show"}
      </button>
    </span>
  );
}
function Form({
  fields,
  initial = {},
  onSubmit,
  submit = "Save changes",
  onCancel,
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false), [invalid,setInvalid]=useState({});
  const lock=useRef(false), formId=useId();
  return (
    <form
      className="form"
      aria-busy={busy}
      onInput={e=>{const name=e.target.name;if(name)setInvalid(previous=>({...previous,[name]:""}));}}
      onSubmit={async (e) => {
        e.preventDefault();
        if(lock.current)return;
        lock.current=true;
        const formElement = e.currentTarget;
        const values = Object.fromEntries(new FormData(formElement));
        for (const field of fields)
          if (field.type === "number" && values[field.name] !== "")
            values[field.name] = Number(values[field.name]);
        setBusy(true);
        setError("");
        setInvalid({});
        try {
          await onSubmit(values);
          if (
            [
              "Publish post",
              "Send message",
              "Send comment",
              "Submit contribution record",
              "Submit donation for review",
              "Change password",
            ].includes(submit)
          )
            formElement.reset();
        } catch (err) {
          const errors=getFieldErrors(err,fields);setInvalid(errors);
          setError(Object.keys(errors).length ? "Please check the highlighted fields." : errorText(err));
          const first=formElement.elements.namedItem(Object.keys(errors)[0]);if(first?.type !== "hidden")requestAnimationFrame(()=>first?.focus?.());
        } finally {
          lock.current=false;
          setBusy(false);
        }
      }}
    >
      <Notice error={error} />
      <fieldset className="form-fields" disabled={busy}>
      {fields.map((f) => f.type === "batch" ? <div key={f.name}><BatchFormField name={f.name} label={f.label || "Batch"} optional={f.optional} initial={initial[f.name] || ""}/>{invalid[f.name] && <small className="field-error" role="alert">{invalid[f.name]}</small>}</div> : (
        <label key={f.name} htmlFor={`${formId}-${f.name}`}>
          {f.label || (f.name[0].toUpperCase()+f.name.slice(1)).replace(/([a-z])([A-Z])/g,"$1 $2")}{" "}
          {f.optional && <small>(optional)</small>}
          {f.options ? (
            <select
              name={f.name}
              id={`${formId}-${f.name}`}
              aria-invalid={!!invalid[f.name]}
              aria-describedby={invalid[f.name] ? `${formId}-${f.name}-error` : undefined}
              required={!f.optional}
              defaultValue={
                initial[f.name] ??
                (typeof f.options[0] === "object"
                  ? f.options[0].value
                  : f.options[0])
              }
            >
              {f.options.map((o) => (
                <option
                  key={typeof o === "object" ? o.value : o}
                  value={typeof o === "object" ? o.value : o}
                >
                  {typeof o === "object" ? o.label : o}
                </option>
              ))}
            </select>
          ) : f.area ? (
            <textarea
              name={f.name}
              id={`${formId}-${f.name}`}
              aria-invalid={!!invalid[f.name]}
              aria-describedby={invalid[f.name] ? `${formId}-${f.name}-error` : undefined}
              minLength={f.minLength}
              placeholder={f.placeholder}
              maxLength={f.max || 8000}
              required={!f.optional}
              defaultValue={initial[f.name] || ""}
            />
          ) : (
            <InputField
              aria-label={f.type === "password" ? f.label || (f.name[0].toUpperCase()+f.name.slice(1)).replace(/([a-z])([A-Z])/g,"$1 $2") : undefined}
              name={f.name}
              id={`${formId}-${f.name}`}
              aria-invalid={!!invalid[f.name]}
              aria-describedby={invalid[f.name] ? `${formId}-${f.name}-error` : undefined}
              type={f.type || "text"}
              min={f.min}
              max={f.max}
              minLength={f.minLength}
              maxLength={f.type === "password" ? 72 : f.type === "number" || f.type === "datetime-local" || f.type === "date" ? undefined : f.max || 500}
              required={!f.optional}
              defaultValue={initial[f.name] ?? ""}
              placeholder={f.placeholder}
              step={f.type === "number" ? f.step ?? "any" : undefined}
            />
          )}
          {invalid[f.name] && <small className="field-error" id={`${formId}-${f.name}-error`}>{invalid[f.name]}</small>}
        </label>
      ))}
      </fieldset>
      <div className="actions">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Saving…" : submit}
        </button>
        {onCancel && (
          <button type="button" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
function Modal({ title, onClose, children, closeDisabled = false }) {
  const dialog=useRef(null), closeRef=useRef(onClose), titleId=useId();
  closeRef.current=onClose;
  const blocked=()=>closeDisabled || !!dialog.current?.querySelector('[aria-busy="true"]');
  useEffect(()=>{
    const previous=document.activeElement, original=document.body.style.overflow;
    document.body.style.overflow="hidden";
    (dialog.current?.querySelector('input:not([type="hidden"]),select,textarea') || dialog.current?.querySelector('button'))?.focus();
    const trap=e=>{
      if(e.key !== "Tab")return;
      const items=[...(dialog.current?.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') || [])].filter(el=>el.getClientRects().length);
      if(!items.length){e.preventDefault();dialog.current?.focus();return;}
      const first=items[0],last=items[items.length-1];
      if(e.shiftKey && (document.activeElement===first || !dialog.current?.contains(document.activeElement))){e.preventDefault();last.focus();}
      else if(!e.shiftKey && (document.activeElement===last || !dialog.current?.contains(document.activeElement))){e.preventDefault();first.focus();}
    };
    document.addEventListener("keydown",trap);
    return()=>{document.removeEventListener("keydown",trap);document.body.style.overflow=original;if(previous?.isConnected)previous.focus();};
  },[]);
  useEffect(() => {
    const close = (e) => !blocked() && e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose, closeDisabled]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) =>
        !blocked() && e.target === e.currentTarget && onClose()
      }
    >
      <section
        className="modal"
        ref={dialog}
        tabIndex={-1}
        aria-labelledby={titleId}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="row between">
          <h2 id={titleId}>{title}</h2>
          <button type="button" aria-label="Close" onClick={()=>{if(!blocked())onClose();}} disabled={closeDisabled}>
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Action({ children, run, className = "", title, "aria-label": ariaLabel }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        aria-busy={busy}
        className={className}
        title={title}
        aria-label={ariaLabel}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await run();
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Working…" : children}
      </button>
      <Notice error={error} />
    </>
  );
}
function Brand() {
  const { user } = useAuth();
  return (
    <Link className="brand" aria-label="CampusBond" to={user ? "/app/feed" : "/"}>
      <span className="brand-mark">
        <GraduationCap size={25} />
      </span>
      <span>CampusBond</span>
    </Link>
  );
}

export {
  api,
  useAuth,
  errorText,
  admin,
  date,
  money,
  useLoad,
  useDebounced,
  Avatar,
  Status,
  Notice,
  Loading,
  Empty,
  Head,
  Pager,
  Form,
  Modal,
  Action,
  Brand,
  AuthProvider,
};
