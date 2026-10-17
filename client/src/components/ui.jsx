import { BatchFormField } from "./BatchPicker.jsx";
import React, { createContext, useContext, useEffect, useState } from "react";
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
  const [state, set] = useState({ data: null, loading: true, error: "" });
  const [version, bump] = useState(0);
  useEffect(() => {
    let live = true;
    set((s) => ({ ...s, loading: true, error: "" }));
    api
      .get(url)
      .then((r) => live && set({ data: r.data, loading: false, error: "" }))
      .catch(
        (e) => live && set({ data: null, loading: false, error: errorText(e) }),
      );
    return () => {
      live = false;
    };
  }, [url, version]);
  return { ...state, reload: () => bump((x) => x + 1) };
}
function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true);
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
function Notice({ error }) {
  return error ? (
    <div className="notice" role="alert">
      {error}
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
    [busy, setBusy] = useState(false);
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const formElement = e.currentTarget;
        const values = Object.fromEntries(new FormData(formElement));
        for (const field of fields)
          if (field.type === "number" && values[field.name] !== "")
            values[field.name] = Number(values[field.name]);
        setBusy(true);
        setError("");
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
          setError(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Notice error={error} />
      {fields.map((f) => f.type === "batch" ? <BatchFormField key={f.name} name={f.name} label={f.label || "Batch"} optional={f.optional} initial={initial[f.name] || ""} /> : (
        <label key={f.name}>
          {f.label || f.name.replace(/([A-Z])/g, " $1")}{" "}
          {f.optional && <small>(optional)</small>}
          {f.options ? (
            <select
              name={f.name}
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
              maxLength={f.max || 8000}
              required={!f.optional}
              defaultValue={initial[f.name] || ""}
            />
          ) : (
            <InputField
              name={f.name}
              type={f.type || "text"}
              min={f.min}
              max={f.max}
              minLength={f.minLength}
              maxLength={f.type === "password" ? 72 : 500}
              required={!f.optional}
              defaultValue={initial[f.name] ?? ""}
              placeholder={f.placeholder}
              step={f.type === "number" ? f.step ?? "any" : undefined}
            />
          )}
        </label>
      ))}
      <div className="actions">
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : submit}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
function Modal({ title, onClose, children, closeDisabled = false }) {
  useEffect(() => {
    const close = (e) => !closeDisabled && e.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose, closeDisabled]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) =>
        !closeDisabled && e.target === e.currentTarget && onClose()
      }
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="row between">
          <h2>{title}</h2>
          <button aria-label="Close" onClick={onClose} disabled={closeDisabled}>
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Action({ children, run, className = "" }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        className={className}
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
    <Link className="brand" to={user ? "/app/feed" : "/"}>
      <span className="brand-mark">
        <GraduationCap size={25} />
      </span>
      <span>
        NUB
        <span className="brand-connect">
          Connect<span className="dot">.</span>
        </span>
      </span>
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
