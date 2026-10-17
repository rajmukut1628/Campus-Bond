import { BatchPicker } from "../components/BatchPicker.jsx";
import { BulkMembers } from "./BulkMembers.jsx";
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

import {
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
} from "../components/ui.jsx";
function Notifications() {
  const { user } = useAuth(), navigate = useNavigate();
  const [page, setPage] = useState(1), [category, setCategory] = useState(""), [status, setStatus] = useState("all"), [actionError, setActionError] = useState("");
  const { data, loading, error, reload } = useLoad(`/notifications?page=${page}&status=${status}${category ? "&category=" + category : ""}`);
  const view = {
    student: { title: "Your next step starts here.", description: "Mentor responses, messages and opportunities selected for your journey.", label: "STUDENT NOTIFICATION CENTRE", focus: "Your learning circle", note: "Track mentor decisions, event bookings and your Alumni conversion. Your mentor sends the first message after accepting.", links: [["/app/requests", "My mentorship requests"], ["/app/conversion", "Alumni conversion"], ["/app/jobs", "Career opportunities"]], categories: [["mentorship", "My mentors"], ["messages", "Messages"], ["events", "My events"], ["careers", "Careers"], ["reviews", "Conversion updates"], ["giving", "Giving"], ["community", "Community"], ["moderation", "My posts"], ["account", "Account"]] },
    alumni: { title: "Your impact, in the loop.", description: "Incoming mentees, peer guidance and activity around the opportunities you share.", label: "ALUMNI NOTIFICATION CENTRE", focus: "Your mentoring circle", note: "Review incoming requests, welcome accepted mentees with a first message, and follow bookings and responses to your posts. Your own peer mentorship updates appear here too.", links: [["/app/requests", "Review mentorship requests"], ["/app/messages", "Mentoring conversations"], ["/app/events", "My events & participants"]], categories: [["mentorship", "Mentoring & guidance"], ["messages", "Conversations"], ["community", "Post engagement"], ["events", "Events & bookings"], ["giving", "Giving activity"], ["careers", "Career network"], ["moderation", "Post updates"], ["reviews", "Review updates"], ["account", "Account"]] },
    admin: { title: "Your community needs you.", description: "Review queues, new publications and the administration work that matters.", label: "ADMINISTRATOR NOTIFICATION CENTRE", focus: "Your review desk", note: "Review Alumni conversion and contribution submissions. Check new community publications and follow account updates within your access.", links: [["/app/alumni-requests", "Alumni conversion requests"], ["/app/donations", "Review contributions"], ["/app/users", "Manage members"]], categories: [["reviews", "Review queue"], ["moderation", "Content oversight"], ["account", "Account updates"], ["events", "Event operations"], ["giving", "Contributions"], ["community", "Community responses"], ["careers", "Career posts"], ["messages", "Messages"], ["mentorship", "Mentorship"]] },
    superadmin: { title: "A clear view of your community.", description: "Administration activity, review queues and content oversight in one place.", label: "SUPER ADMIN NOTIFICATION CENTRE", focus: "Platform oversight", note: "Track administrator actions and account changes, review pending requests and keep community content in view. Detailed activity remains available in your Activity workspace.", links: [["/app/activity", "User activity"], ["/app/admins", "Manage administrators"], ["/app/alumni-requests", "Review Alumni conversions"]], categories: [["account", "Administration activity"], ["reviews", "Review queue"], ["moderation", "Content oversight"], ["events", "Event operations"], ["giving", "Contributions"], ["community", "Community responses"], ["careers", "Career posts"], ["messages", "Messages"], ["mentorship", "Mentorship"]] }
  }[user.role];
  const icons = { mentorship: HeartHandshake, messages: MessagesSquare, events: CalendarDays, careers: BriefcaseBusiness, giving: HeartHandshake, community: Globe, reviews: CheckCircle2, moderation: ShieldCheck, account: Settings };
  const counts = Object.fromEntries((data?.counts || []).map(c => [c._id, c]));
  useEffect(() => { const refresh = () => { if (!document.hidden) reload(); }; const timer = setInterval(refresh, 20000); window.addEventListener("focus", refresh); return () => { clearInterval(timer); window.removeEventListener("focus", refresh); }; }, [category, status, page]);
  const changed = () => { reload(); window.dispatchEvent(new Event("notifications-changed")); };
  const mark = async (item, read) => { await api.patch(`/notifications/${item._id}`, { read }); changed(); };
  return <>
    <Head eyebrow={view.label} title={view.title} description={view.description}>
      <Action run={async () => { await api.patch("/notifications/read"); changed(); }}>Mark all read <Check size={16} /></Action>
    </Head>
    <div className="notification-overview">
      <div><span className="eyebrow">YOUR INBOX</span><strong>{data?.unread || 0}<small>unread updates</small></strong><p>Personal updates. Clear next steps.</p></div>
      <div><span className="eyebrow">{view.focus}</span><p>{view.note}</p><div className="notification-shortcuts">{view.links.map(([path, label]) => <Link key={path} to={path}>{label} <ArrowUpRight size={13} /></Link>)}</div></div>
    </div>
    <Notice error={error || actionError} />
    <div className="notification-filters" aria-label="Notification categories">
      {[["", "All activity"], ...view.categories].map(([key,label]) => <button key={key} className={category === key ? "active" : ""} onClick={() => { setCategory(key); setPage(1); }}>{label}{(key ? counts[key]?.unread : data?.unread) > 0 && <span>{key ? counts[key].unread : data.unread}</span>}</button>)}
    </div>
    <div className="notification-toolbar"><div className="notification-status" aria-label="Read status">{[["all", "All"], ["unread", "Unread"], ["read", "Read"]].map(([key,label]) => <button key={key} className={status === key ? "active" : ""} onClick={() => { setStatus(key); setPage(1); }}>{label}</button>)}</div><small>{data?.total || 0} updates · newest first</small><button onClick={reload} disabled={loading}>Refresh</button></div>
    {loading && !data ? <Loading /> : data?.items.length ? <div className="notification-stream">{data.items.map(item => {
      const Icon = icons[item.category] || Bell;
      return <article className={`notification-item ${item.read ? "" : "unread"}`} key={item._id}>
        <div className={`notification-symbol ${item.category}`}>{item.actor ? <Avatar user={item.actor} /> : <Icon size={20} />}</div>
        <div className="notification-copy"><div className="notification-meta"><span>{view.categories.find(([key]) => key === item.category)?.[1] || "Update"}</span><time dateTime={item.createdAt}>{date(item.createdAt)}</time>{!item.read && <i aria-label="Unread" />}</div>
          <Link to={item.link || "/app/notifications"} onClick={async e => { e.preventDefault(); try { if (!item.read) await mark(item, true); navigate(item.link?.startsWith("/app/") ? item.link : "/app/notifications"); } catch (err) { setActionError(errorText(err)); } }}>{item.body}</Link>
        </div>
        <Action run={() => mark(item, !item.read)}>{item.read ? "Mark unread" : "Mark read"}</Action>
      </article>;
    })}</div> : <div className="notification-empty"><Bell size={30} /><h2>{status === "unread" ? "You’re all caught up." : "No updates here yet."}</h2><p>Relevant activity will appear here automatically.</p></div>}
    <Pager {...{ data, page, setPage }} />
  </>;
}
function Management({ kind }) {
  const { data: accountOptions } = useLoad("/admin/account-options");
  const [creatingLogin, setCreatingLogin] = useState(false);
  const [bulk, setBulk] = useState(false);
  const { user, setUser } = useAuth(),
    navigate = useNavigate();
  const [page, setPage] = useState(1),
    [editing, setEditing] = useState(null),
    [show, setShow] = useState(false),
    [operation, setOperation] = useState(null),
    [success, setSuccess] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    role: "",
    batch: "",
    department: "",
  });
  const [searchFilters, setSearchFilters] = useState(filters);
  useEffect(() => {
    const timer = setTimeout(() => setSearchFilters(filters), 300);
    return () => clearTimeout(timer);
  }, [filters]);
  const changeFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  };
  useEffect(() => {
    setPage(1);
    setShow(false);
    setEditing(null);
    setCreatingLogin(false);
    setOperation(null);
    setSuccess("");
    setFilters({ q: "", role: "", batch: "", department: "" });
  }, [kind]);
  const endpoint =
    kind === "admins"
      ? "/superadmin/admins"
      : kind === "verified"
        ? "/admin/verified-users"
        : "/admin/users";
  const query = new URLSearchParams({ page: String(page) });
  if (kind === "users")
    for (const [key, value] of Object.entries(searchFilters))
      if (value) query.set(key, value);
  const { data, error, loading, reload } = useLoad(
    endpoint + "?" + query.toString(),
  );
  const stateOf = (item) =>
    item.status && item.status !== "active"
      ? item.status
      : item.active
        ? "active"
        : "blocked";
  const refresh = () => {
    if (data?.items.length === 1 && page > 1) setPage((p) => p - 1);
    else reload();
  };
  const formFields = [
    { name: "name" },
    { name: "email", type: "email" },
    ...(kind !== "admins" && !["admin", "superadmin"].includes(editing?.role) ? [{ name: "universityId", label: "University ID" },
    {
      name: "department",
      label: "Department",
      options: [
        { value: "", label: "Choose department" },
        ...(accountOptions?.departments || []),
        ...(editing?.department &&
        !accountOptions?.departments?.includes(editing.department)
          ? [editing.department]
          : []),
      ],
      optional: !!editing && !creatingLogin,
    }] : []),
    ...(kind !== "admins" && !["admin", "superadmin"].includes(editing?.role) ? [{ name: "batch", type: "batch", label: "Batch", optional: true }] : []),
    ...(kind === "verified" || (kind === "users" && !editing)
      ? [
          {
            name: "role",
            options: editing?.claimed ? [editing.role] : ["student", "alumni"],
          },
        ]
      : []),
    ...(!editing || creatingLogin
      ? [
          {
            name: "password",
            label: "Password (minimum 11 characters)",
            type: "password",
            minLength: 11,
          },
        ]
      : []),
  ];
  const title =
    kind === "users"
      ? "Manage members"
      : kind === "verified"
        ? "Verified university accounts"
        : "Manage administrators";
  const actionText = {
    suspended: "Suspend",
    blocked: "Block",
    active: "Reactivate",
    delete: "Delete",
    transfer: "Transfer ownership",
  };
  return (
    <>
      <Head
        eyebrow="COMMUNITY ADMINISTRATION"
        title={title}
        description={
          kind === "verified"
            ? "Manage university verification and linked member access."
            : "Manage accounts with role-based access and recorded administrative actions."
        }
      >
        <div className="row wrap">
          {kind !== "admins" && (
            <button onClick={() => setBulk(true)}>
              <Users size={17} /> Add multiple members
            </button>
          )}
          {true && (
            <button
              className="primary"
              onClick={() => {
                setEditing(null);
                setCreatingLogin(false);
                setShow(true);
              }}
            >
              <Plus size={17} />
              Add {kind === "admins" ? "administrator" : "member account"}
            </button>
          )}
        </div>
      </Head>
      {bulk && (
        <BulkMembers
          options={accountOptions}
          onClose={() => setBulk(false)}
          onCreated={(count) => {
            setSuccess(`${count} accounts created through bulk import.`);
            reload();
          }}
        />
      )}
      {kind === "users" && (
        <section className="member-filters card" aria-label="Member filters">
          <label className="member-search">
            Search members
            <input
              type="search"
              aria-label="Search members"
              maxLength={100}
              placeholder="Name, email, ID, batch or department…"
              value={filters.q}
              onChange={(e) => changeFilter("q", e.target.value)}
            />
          </label>
          <label>
            Account role
            <select
              value={filters.role}
              onChange={(e) => changeFilter("role", e.target.value)}
            >
              <option value="">
                {filters.q || filters.batch || filters.department
                  ? "Search all permitted roles"
                  : "Students (default)"}
              </option>
              <option value="all">All permitted roles</option>
              <option value="student">Student</option>
              <option value="alumni">Alumni</option>
              {user.role === "superadmin" && (
                <option value="admin">Admin</option>
              )}
            </select>
          </label>
          <BatchPicker label="Batch filter" value={filters.batch} onChange={value => changeFilter("batch", value)} />
          <label>
            Department
            <input
              maxLength={100}
              value={filters.department}
              placeholder="e.g. CSE"
              onChange={(e) => changeFilter("department", e.target.value)}
            />
          </label>
          <div className="filter-description">
            <p>
              Default: Student accounts. A search checks all permitted roles
              unless you select a specific role. Maximum 20 accounts per page.
            </p>
            <button
              onClick={() => {
                setFilters({ q: "", role: "", batch: "", department: "" });
                setPage(1);
              }}
            >
              Reset filters
            </button>
          </div>
        </section>
      )}
      <Notice error={error} />
      {kind === "users" && data && !loading && (
        <p className="results-count" role="status">
          {data.total
            ? "Showing " +
              ((page - 1) * 20 + 1) +
              "–" +
              Math.min(page * 20, data.total) +
              " of " +
              data.total +
              " accounts"
            : "No matching accounts"}{" "}
          · 20 per page
        </p>
      )}
      {success && (
        <div className="success" role="status">
          {success}
        </div>
      )}
      {kind === "admins" && (
        <div className="management-help">
          <ShieldCheck size={18} />
          <p>
            You are the current platform owner. Transfer ownership to an active
            administrator to make them the Super Admin. Your account will become
            an Admin.
          </p>
        </div>
      )}
      <section className="card management-table">
        {loading ? (
          <Loading />
        ) : data?.items.length ? (
          data.items.map((item) => (
            <div className="table-row management-row" key={item._id}>
              <div className="member-identity">
                <strong>{item.name}</strong>
                <small>
                  {item.email}{!["admin", "superadmin"].includes(item.role) && ` · ${item.universityId}`}
                </small>
                {!["admin", "superadmin"].includes(item.role) && (item.department || item.batch) && (
                  <small>
                    {[item.department, !["admin", "superadmin"].includes(item.role) && item.batch && "Batch " + item.batch]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                )}
              </div>
              <div className="member-badges">
                <Status value={item.role} />
                <Status value={stateOf(item)} />
                {stateOf(item) === "suspended" && item.suspensionUntil && <small>Until {new Date(item.suspensionUntil).toLocaleString()}</small>}
                {stateOf(item) === "suspended" && item.suspensionReason && <small>{item.suspensionReason}</small>}
                {kind === "verified" && (
                  <Status value={item.claimed ? "claimed" : "unclaimed"} />
                )}
              </div>
              <div className="management-actions">
                {kind === "verified" && !item.claimed && item.active && (
                  <button
                    className="primary"
                    onClick={() => {
                      setEditing(item);
                      setCreatingLogin(true);
                      setShow(true);
                    }}
                  >
                    Create login
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditing(item);
                    setCreatingLogin(false);
                    setShow(true);
                  }}
                >
                  Edit
                </button>
                {stateOf(item) === "active" ? (
                  <>
                    <button
                      onClick={() => setOperation({ item, type: "suspended" })}
                    >
                      Suspend
                    </button>
                    <button
                      onClick={() => setOperation({ item, type: "blocked" })}
                    >
                      Block
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setOperation({ item, type: "active" })}
                    >
                      Reactivate
                    </button>
                    {stateOf(item) === "suspended" && (
                      <button
                        onClick={() => setOperation({ item, type: "blocked" })}
                      >
                        Block
                      </button>
                    )}
                  </>
                )}
                {kind === "admins" && stateOf(item) === "active" && (
                  <button
                    className="ownership-button"
                    onClick={() => setOperation({ item, type: "transfer" })}
                  >
                    Transfer ownership
                  </button>
                )}
                <button
                  className="danger-button"
                  onClick={() => setOperation({ item, type: "delete" })}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <Empty />
        )}
      </section>
      <Pager {...{ data, page, setPage }} numbered={kind === "users"} />
      {show && (
        <Modal
          title={
            creatingLogin
              ? "Create member login"
              : editing
                ? "Edit account"
                : kind === "admins"
                  ? "Add administrator"
                  : "Add verified account"
          }
          onClose={() => setShow(false)}
        >
          {editing && kind === "verified" && editing.claimed && (
            <p>
              Changes also update the activated member. Their role stays the
              same. Existing sessions will expire after saving.
            </p>
          )}
          {editing && kind === "users" && (
            <p>
              Changes also update the linked verification record. Existing
              sessions will expire after saving.
            </p>
          )}
          <Form
            key={(editing?._id || "new") + String(creatingLogin)}
            fields={formFields}
            initial={editing || {}}
            onSubmit={async (values) => {
              let result;
              if (creatingLogin)
                result = await api.post("/admin/users", values);
              else if (editing)
                result = await api.put(endpoint + "/" + editing._id, values);
              else result = await api.post(endpoint, values);
              setShow(false);
              setSuccess(
                result.data.message || "Account saved. The member can sign in directly.",
              );
              reload();
            }}
          />
        </Modal>
      )}
      {operation && (
        <Modal
          title={actionText[operation.type] + " — " + operation.item.name}
          onClose={() => setOperation(null)}
        >
          {operation.type === "transfer" ? (
            <p>
              <strong>{operation.item.name}</strong> ({operation.item.email})
              will become the Super Admin with full platform ownership. You will
              become an Admin. Both accounts’ old sessions will be revoked.
              Enter your current password and type TRANSFER to confirm.
            </p>
          ) : operation.type === "delete" ? (
            <p>
              This account will lose access and be removed from management
              lists.{" "}
              {kind === "verified"
                ? "An activated linked member is deleted too. "
                : ""}
              Related community and financial history is retained. This action
              has no restore option in this interface. Type DELETE to confirm.
            </p>
          ) : (
            <p>
              {operation.type === "active"
                ? "Access will be restored. The member must sign in again."
                : "Access will be disabled immediately and existing sessions revoked."}{" "}
              {kind === "verified" || kind === "users"
                ? "The linked verification record and member account are updated together."
                : ""}
            </p>
          )}
          <Form
            key={operation.item._id + operation.type}
            fields={
              operation.type === "transfer"
                ? [
                    {
                      name: "currentPassword",
                      label: "Your current password",
                      type: "password",
                    },
                    { name: "confirmation", label: "Type TRANSFER" },
                  ]
                : operation.type === "delete"
                  ? [{ name: "confirmation", label: "Type DELETE" }]
                  : operation.type === "suspended" ? [
                    { name: "suspensionDays", label: "Suspend for how many days?", type: "number", min: 1, max: 3650, step: 1 },
                    { name: "suspensionReason", label: "Reason", area: true, optional: true, max: 500 }
                  ] : []
            }
            submit={actionText[operation.type]}
            onSubmit={async (values) => {
              if (operation.type === "transfer") {
                if (values.confirmation !== "TRANSFER")
                  throw new Error("Type TRANSFER to confirm.");
                const result = await api.post(
                  "/superadmin/ownership/transfer",
                  {
                    adminId: operation.item._id,
                    currentPassword: values.currentPassword,
                  },
                );
                setUser(result.data.user);
                setOperation(null);
                navigate("/app", { state: { notice: result.data.message } });
              } else {
                if (operation.type === "delete") {
                  if (values.confirmation !== "DELETE")
                    throw new Error("Type DELETE to confirm.");
                  await api.delete(endpoint + "/" + operation.item._id);
                } else
                  await api.patch(endpoint + "/" + operation.item._id, {
                    status: operation.type,
                    ...(operation.type === "suspended" ? { suspensionDays: values.suspensionDays, suspensionReason: values.suspensionReason } : {}),
                  });
                setSuccess(
                  actionText[operation.type] + " completed successfully.",
                );
                setOperation(null);
                refresh();
              }
            }}
          />
        </Modal>
      )}
    </>
  );
}
function Unauthorized() {
  return (
    <Empty>
      You don’t have access to this page.{" "}
      <Link to="/app">Go to your dashboard</Link>
    </Empty>
  );
}
function NotFound() {
  return (
    <Empty>
      This page couldn’t be found. <Link to="/app">Go to your dashboard</Link>
    </Empty>
  );
}

export { Notifications, Management, Unauthorized, NotFound };
