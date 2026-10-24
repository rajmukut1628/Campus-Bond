import React, { useEffect, useState } from "react";
import { Activity, ArrowLeft, Search, Users } from "lucide-react";
import {
  useLoad,
  Head,
  Notice,
  Loading,
  Empty,
  Pager,
  Avatar,
  Status,
  date,
} from "../components/ui.jsx";
const sections = [
  ["admin", "General Admin"],
  ["alumni", "Alumni"],
  ["student", "Student"],
];
const roleName = (role) => sections.find(([key]) => key === role)?.[1] || role;
export function ActivityPage() {
  const [role, setRole] = useState("admin"),
    [page, setPage] = useState(1),
    [person, setPerson] = useState(null),
    [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(q), 300);
    return () => clearTimeout(timer);
  }, [q]);
  const query = new URLSearchParams({ role, page: String(page) });
  if (search) query.set("q", search);
  if (person) query.set("userId", person._id);
  if (from) query.set("from", new Date(from + "T00:00:00").toISOString());
  if (to) query.set("to", new Date(to + "T23:59:59.999").toISOString());
  const { data, error, loading, reload } = useLoad(
    "/superadmin/activity" + (person ? "" : "/users") + "?" + query.toString(),
  );
  const resetPage = (fn) => {
    fn();
    setPage(1);
  };
  return (
    <>
      <Head
        eyebrow="SUPER ADMIN ONLY"
        title="Activity"
        description="User-wise activity across your university community."
      >
        <button onClick={reload}>Refresh activity</button>
      </Head>
      <div
        className="activity-sections"
        role="tablist"
        aria-label="Activity by role"
      >
        {sections.map(([key, label]) => (
          <button
            role="tab"
            aria-selected={role === key}
            key={key}
            className={role === key ? "primary" : ""}
            onClick={() => {
              setRole(key);
              setPerson(null);
              setPage(1);
            }}
          >
            <Users size={17} />
            {label}
          </button>
        ))}
      </div>
      <section className="card activity-filters" aria-label="Activity filters">
        <label>
          Search user
          <input
            type="search"
            maxLength={100}
            placeholder="Name, email or university ID…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPerson(null);
              setPage(1);
            }}
          />
        </label>
        <label>
          From date
          <input
            type="date"
            value={from}
            onChange={(e) => resetPage(() => setFrom(e.target.value))}
          />
        </label>
        <label>
          To date
          <input
            type="date"
            value={to}
            onChange={(e) => resetPage(() => setTo(e.target.value))}
          />
        </label>
        <button
          onClick={() => {
            setQ("");
            setSearch("");
            setFrom("");
            setTo("");
            setPerson(null);
            setPage(1);
          }}
        >
          Reset filters
        </button>
      </section>
      <div className="section-title">
        <h2>
          {person
            ? person.name + " — " + roleName(role) + " activity"
            : roleName(role) + " — user-wise activity"}
        </h2>
        {person && (
          <button
            onClick={() => {
              setPerson(null);
              setPage(1);
            }}
          >
            <ArrowLeft size={16} />
            All users
          </button>
        )}
      </div>
      <p className="muted">
        Successful actions are recorded from when this feature was enabled.
        Activities stay in the role held when the action happened. Passwords,
        message contents and payment references are excluded.
      </p>
      <Notice error={error} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        <>
          <p className="results-count" role="status">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of{" "}
            {data.total} {person ? "activities" : "users"} · 20 per page
          </p>
          <section className="card activity-list">
            {data.items.map((item) =>
              person ? (
                <article className="activity-event" key={item._id}>
                  <span className="activity-event-icon">
                    <Activity size={18} />
                  </span>
                  <div>
                    <strong>{item.summary}</strong>
                    <small>
                      {item.actor?.name} · {item.actor?.universityId}
                    </small>
                    <small>{date(item.createdAt)}</small>
                  </div>
                  <Status value={item.actorRole} />
                </article>
              ) : (
                <article className="activity-user" key={item._id}>
                  <Avatar user={item.actor} />
                  <div className="activity-user-info">
                    <strong>{item.actor?.name || "Former member"}</strong>
                    <small>
                      {item.actor?.email} · {item.actor?.universityId}
                    </small>
                    <p>{item.lastAction}</p>
                    <small>Last activity {date(item.lastAt)}</small>
                  </div>
                  <div className="activity-count">
                    <strong>{item.count}</strong>
                    <small>activities</small>
                  </div>
                  <button
                    onClick={() => {
                      setPerson(item.actor);
                      setPage(1);
                    }}
                  >
                    View activity
                  </button>
                </article>
              ),
            )}
          </section>
          <Pager {...{ data, page, setPage }} numbered />
        </>
      ) : (
        <Empty>
          No recorded {roleName(role).toLowerCase()} activity matches these
          filters yet.
        </Empty>
      )}
    </>
  );
}
