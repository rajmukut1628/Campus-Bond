import { ContactNumber } from "../components/ContactNumber.jsx";
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
const resourceFields = {
  jobs: [
    {
      name: "contactNumber",
      label: "Contact number",
      type: "tel",
      optional: true,
      placeholder: "+880 1XXXXXXXXX",
    },
    { name: "title" },
    { name: "company" },
    { name: "location" },
    { name: "description", area: true },
    {
      name: "type",
      options: ["full-time", "part-time", "internship", "contract", "not-specified"],
    },
    { name: "status", options: ["open", "closed"] },
    {
      name: "closesAt",
      label: "Closing date (your local time)",
      type: "datetime-local",
    },
    {
      name: "applicationUrl",
      label: "Application URL (HTTPS)",
      type: "url",
      optional: true,
    },
  ],
  events: [
    {
      name: "contactNumber",
      label: "Contact number",
      type: "tel",
      optional: true,
      placeholder: "+880 1XXXXXXXXX",
    },
    { name: "title" },
    { name: "description", area: true },
    { name: "location" },
    {
      name: "startsAt",
      label: "Start time (your local time)",
      type: "datetime-local",
    },
    { name: "capacity", type: "number", min: 1, max: 100000 },
    { name: "status", options: ["published", "cancelled"] },
  ],
  donations: [
    {
      name: "contactNumber",
      label: "Contact number",
      type: "tel",
      optional: true,
      placeholder: "+880 1XXXXXXXXX",
    },
    { name: "title" },
    { name: "description", area: true },
    { name: "goal", label: "Goal (BDT)", type: "number", min: 1 },
    {
      name: "instructions",
      label: "Manual contribution instructions",
      area: true,
    },
    { name: "status", options: ["open", "closed"] },
  ],
};
const localDate = (v) => {
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const extras = {
  jobs: [
    {
      name: "workMode",
      label: "Work arrangement",
      options: ["on-site", "remote", "hybrid", "not-specified"],
    },
    { name: "salary", label: "Salary range & currency", optional: true },
    {
      name: "requirements",
      label: "Requirements & qualifications",
      area: true,
      optional: true,
    },
    { name: "benefits", area: true, optional: true },
    { name: "applicationEmail", type: "email", optional: true },
  ],
  events: [
    { name: "organizer", optional: true },
    { name: "endsAt", type: "datetime-local", optional: true },
    { name: "registrationDeadline", type: "datetime-local", optional: true },
    {
      name: "onlineUrl",
      label: "Online meeting URL (HTTPS)",
      type: "url",
      optional: true,
    },
    { name: "agenda", area: true, optional: true },
  ],
  donations: [
    { name: "beneficiary", optional: true },
    { name: "purpose", area: true, optional: true },
    { name: "bkashNumber", label: "bKash receiving number (optional)", type: "tel", optional: true },
    { name: "nagadNumber", label: "Nagad receiving number (optional)", type: "tel", optional: true },
    { name: "deadline", type: "datetime-local", optional: true },
  ],
};
for (const kind of Object.keys(resourceFields))
  resourceFields[kind].push(...extras[kind], {
    name: "topic",
    label: "Newsfeed interest",
    options: [
      "Community",
      "Technology",
      "Careers",
      "Business",
      "Science",
      "Arts & Culture",
      "Education",
      "Health",
      "Sports",
      "Environment",
    ],
  });
function LinkedText({ text = "" }) {
  return String(text).split(/(https:\/\/[^\s]+)/g).map((part, i) => part.startsWith("https://") ? <a key={i} href={part} target="_blank" rel="noreferrer">{part}</a> : part);
}
function PostAuthor({ item }) {
  const owner = item.owner;
  return <div className="feed-author resource-author">
    {owner?._id ? <Link to={`/app/members/${owner._id}`}><Avatar user={owner} /></Link> : <Avatar user={owner} />}
    <div>{owner?._id ? <Link to={`/app/members/${owner._id}`}><strong>{owner.name}</strong></Link> : <strong>University community</strong>}
      <small>Posted by {owner?.role === "superadmin" ? "Super Admin" : owner?.role === "admin" ? "Administrator" : owner?.role === "alumni" ? "Alumni" : "member"} · {date(item.createdAt)}</small>
    </div>
  </div>;
}
function Cover({ item }) {
  return item.cover ? (
    <img
      className="resource-cover"
      src={item.cover}
      alt={item.title + " cover"}
    />
  ) : null;
}
function ResourceEditor({ kind, item, onSaved }) {
  const [file, setFile] = useState(null),
    [saved, setSaved] = useState(item),
    [remove, setRemove] = useState(false),
    [preview, setPreview] = useState(""),
    [mode, setMode] = useState(item?.mode || (kind === "events" ? "booking" : "fundraising"));
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const initial = { ...item, topic: item?.topics?.[0] || "Community" };
  for (const key of [
    "startsAt",
    "closesAt",
    "endsAt",
    "registrationDeadline",
    "deadline",
  ])
    if (item?.[key]) initial[key] = localDate(item[key]);
  return (
    <>
      <label>
        Cover picture{" "}
        <small>(optional · PNG/JPG/WebP/GIF/AVIF, max 5 MB)</small>
        <input
          aria-label="Cover picture"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>
      {(preview || (!remove && item?.cover)) && (
        <img
          className="resource-cover"
          src={preview || item.cover}
          alt="Cover preview"
        />
      )}
      {item?.cover && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={remove}
            onChange={(e) => setRemove(e.target.checked)}
          />{" "}
          Remove current cover
        </label>
      )}
      {saved && !item && (
        <p className="success">
          Post saved. Complete the picture upload below; retrying will update
          this post.
        </p>
      )}
      {kind === "donations" && <label>Post type<select value={mode} onChange={e => setMode(e.target.value)}><option value="fundraising">Fundraising campaign</option><option value="information">Blood / help information</option></select></label>}
      {kind === "events" && <label>Post type<select value={mode} onChange={e => setMode(e.target.value)}><option value="booking">Upcoming event with booking</option><option value="recap">Past event / Recap</option></select></label>}
      <Form
        fields={resourceFields[kind].filter(f => !(kind === "donations" && mode === "information" && ["goal", "bkashNumber", "nagadNumber"].includes(f.name)) && !(kind === "events" && mode === "recap" && ["capacity", "endsAt", "registrationDeadline", "onlineUrl"].includes(f.name))).map(f => kind === "donations" && mode === "information" && f.name === "instructions" ? { ...f, label: "Official contact and help links" } : kind === "events" && mode === "recap" && f.name === "startsAt" ? { ...f, optional: true, label: "Original event date (only if confirmed)" } : f)}
        initial={initial}
        submit={item ? "Update post" : "Publish post"}
        onSubmit={async (values) => {
          if (file && file.size > 5 * 1024 * 1024)
            throw Error("Choose a picture no larger than 5 MB");
          for (const key of [
            "startsAt",
            "closesAt",
            "endsAt",
            "registrationDeadline",
            "deadline",
          ])
            if (values[key]) values[key] = new Date(values[key]).toISOString();
          if (["donations", "events"].includes(kind)) values.mode = mode;
          values.topics = [values.topic];
          delete values.topic;
          const response = saved
            ? await api.put("/" + kind + "/" + saved._id, values)
            : await api.post("/" + kind, values);
          setSaved(response.data.item);
          if (file) {
            const form = new FormData();
            form.append("image", file);
            await api.post(
              "/" + kind + "/" + response.data.item._id + "/cover",
              form,
            );
          } else if (remove)
            await api.delete(
              "/" + kind + "/" + response.data.item._id + "/cover",
            );
          onSaved();
        }}
      />
    </>
  );
}
function ResourceTools({ kind, item, reload }) {
  const { user } = useAuth(),
    [edit, setEdit] = useState(false),
    navigate = useNavigate();
  if (!admin(user) && String(item.owner?._id || item.owner) !== user._id)
    return null;
  return (
    <section className="card resource-owner">
      <span className="eyebrow">POST MANAGEMENT</span>
      <div className="row wrap">
        <button className="primary" onClick={() => setEdit(true)}>
          Edit / update post
        </button>
        {["archived", "published", ...(admin(user) ? ["hidden"] : [])]
          .filter((v) => v !== (item.visibility || "published"))
          .map((v) => (
            <Action
              key={v}
              run={async () => {
                await api.patch("/" + kind + "/" + item._id + "/visibility", {
                  visibility: v,
                });
                reload();
              }}
            >
              {v === "published"
                ? "Show post"
                : v === "archived"
                  ? "Archive"
                  : "Hide"}
            </Action>
          ))}
        <Action
          run={async () => {
            await api.delete("/" + kind + "/" + item._id);
            navigate("/app/" + kind);
          }}
        >
          Delete post
        </Action>
      </div>
      {edit && (
        <Modal title="Update post" onClose={() => setEdit(false)}>
          <ResourceEditor
            kind={kind}
            item={item}
            onSaved={() => {
              setEdit(false);
              reload();
            }}
          />
        </Modal>
      )}
    </section>
  );
}
function ResourceFacts({ kind, item }) {
  const keys =
    kind === "jobs"
      ? ["workMode", "salary", "requirements", "benefits", "applicationEmail"]
      : kind === "events"
        ? ["organizer", "endsAt", "registrationDeadline", "onlineUrl", "agenda"]
        : ["beneficiary", "purpose", "deadline"];
  return (
    <dl className="resource-facts">
      {keys
        .filter((k) => item[k])
        .map((k) => (
          <div key={k}>
            <dt>{k.replace(/([A-Z])/g, " $1")}</dt>
            <dd className="preserve">
              {["endsAt", "registrationDeadline", "deadline"].includes(k) ? (
                date(item[k])
              ) : k === "onlineUrl" ? (
                <a href={item[k]} target="_blank" rel="noreferrer">
                  Join online event ↗
                </a>
              ) : (
                item[k]
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}
function Resources({ kind }) {
  const { user } = useAuth(),
    [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [mine, setMine] = useState(false),
    [editing, setEditing] = useState(null),
    [modal, setModal] = useState(false);
  useEffect(() => {
    setPage(1);
    setQ("");
    setMine(false);
    setModal(false);
  }, [kind]);
  const { data, error, loading, reload } = useLoad(
    `/${kind}?page=${page}&q=${encodeURIComponent(q)}&mine=${mine}`,
  );
  const canCreate = admin(user) || user.role === "alumni";
  const titles = {
    jobs: [
      "Your next opportunity",
      "Career paths shared by your university network.",
    ],
    events: [
      "There’s more to be part of.",
      "Find your next gathering, workshop, or campus conversation.",
    ],
    donations: [
      "Give a little. Change a lot.",
      "Support the causes that move our community forward.",
    ],
  };
  return (
    <>
      <Head title={titles[kind][0]} description={titles[kind][1]}>
        {canCreate && (
          <button
            className="primary"
            onClick={() => {
              setEditing(null);
              setModal(true);
            }}
          >
            <Plus size={17} />
            Create{" "}
            {kind === "jobs" ? "job" : kind === "events" ? "event" : "campaign"}
          </button>
        )}
      </Head>
      {kind === "jobs" && (
        <div className="row filters">
          <div className="search-box">
            <Search size={18} />
            <input
              placeholder="Search job titles…"
              aria-label="Search jobs"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {canCreate && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={mine}
                onChange={(e) => {
                  setMine(e.target.checked);
                  setPage(1);
                }}
              />
              My listings
            </label>
          )}
        </div>
      )}
      <Notice error={error} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        <div className="cards-grid">
          {data.items.map((item) => (
            <article key={item._id} className="card resource-card">
              <PostAuthor item={item} />
              <Cover item={item} />
              <div className="row between">
                <span className="resource-icon">
                  {kind === "jobs" ? (
                    <BriefcaseBusiness />
                  ) : kind === "events" ? (
                    <CalendarDays />
                  ) : (
                    <HeartHandshake />
                  )}
                </span>
                <Status value={item.status} />
              </div>
              <h2>
                <Link to={`/app/${kind}/${item._id}`}>{item.title}</Link>
              </h2>
              {kind === "jobs" ? (
                <>
                  <strong>{item.company}</strong>
                  <p>
                    <MapPin size={14} />
                    {item.location} · {item.type}
                  </p>
                  <small>Closes {date(item.closesAt)}</small>
                </>
              ) : kind === "events" ? (
                <>
                  <p>
                    <Clock size={14} />
                    {item.mode === "recap" ? "Past event / Recap" : date(item.startsAt)}
                  </p>
                  <p>
                    <MapPin size={14} />
                    {item.location}
                  </p>
                  <small>
                    {item.mode === "recap" ? "Registration closed" : `${item.participants} / ${item.capacity} registered`}
                  </small>
                </>
              ) : (
                <>
                  <p>{item.description.slice(0, 150)}</p>
                  <strong>{item.mode === "information" ? "Official help information" : `${money(item.total || 0)} raised · ${money(item.remaining ?? item.goal)} remaining`}</strong>
                  {item.mode !== "information" && <progress aria-label="Approved funding progress" value={Math.min(item.total || 0,item.goal)} max={item.goal}/>}
                </>
              )}
              <ContactNumber number={item.contactNumber} compact />
              <div className="resource-actions">
                <Link className="button" to={`/app/${kind}/${item._id}`}>
                  View details <ArrowUpRight size={15} />
                </Link>
                {(admin(user) ||
                  (kind === "jobs" &&
                    String(item.owner?._id || item.owner) === user._id)) && (
                  <>
                    <button
                      onClick={() => {
                        setEditing(item);
                        setModal(true);
                      }}
                    >
                      Edit
                    </button>
                    {true && (
                      <Action
                        run={async () => {
                          await api.delete(`/${kind}/${item._id}`);
                          reload();
                        }}
                      >
                        Delete
                      </Action>
                    )}
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty />
      )}
      <Pager {...{ data, page, setPage }} />
      {kind === "donations" && <Contributions />}
      {modal && (
        <Modal
          title={`${editing ? "Edit" : "Create"} ${kind === "donations" ? "campaign" : kind.slice(0, -1)}`}
          onClose={() => setModal(false)}
        >
          <ResourceEditor
            kind={kind}
            item={editing}
            onSaved={() => {
              setModal(false);
              reload();
            }}
          />
        </Modal>
      )}
    </>
  );
}
function JobDetails() {
  const { id } = useParams(),
    { data, error, loading, reload } = useLoad(`/jobs/${id}`);
  if (loading && !data) return <Loading />;
  const item = data?.item;
  return (
    <>
      <Notice error={error} />
      {item && (
        <>
          <Head
            title={item.title}
            description={`${item.company} · ${item.location}`}
          />
          <ResourceTools kind="jobs" item={item} reload={reload} />
          <article className="card detail">
            <PostAuthor item={item} />
            <Cover item={item} />
            <ResourceFacts kind="jobs" item={item} />
            <Status value={item.status} />
            <p>
              {item.type} · Closes {date(item.closesAt)}
            </p>
            <p className="preserve"><LinkedText text={item.description} /></p>
            <ContactNumber
              number={item.contactNumber}
              label="Recruiter contact"
            />
            {item.applicationUrl ? (
              <a
                className="button primary"
                href={item.applicationUrl}
                target="_blank"
                rel="noreferrer"
              >
                View application page <ArrowUpRight size={17} />
              </a>
            ) : (
              <p className="muted">
                No application link has been provided. Follow the instructions
                in the listing.
              </p>
            )}
          </article>
        </>
      )}
    </>
  );
}
function EventDetails() {
  const { id } = useParams(),
    { user } = useAuth(),
    { data, error, loading, reload } = useLoad(`/events/${id}`),
    [show, setShow] = useState(false),
    [confirm, setConfirm] = useState(false);
  if (loading && !data) return <Loading />;
  const item = data?.item;
  return (
    <>
      <Notice error={error} />
      {item && (
        <>
          <Head
            title={item.title}
            description={`${item.mode === "recap" ? "Past event / Recap" : date(item.startsAt)} · ${item.location}`}
          />
          <ResourceTools kind="events" item={item} reload={reload} />
          <div className={show ? "event-workspace" : ""}>
            <article className="card detail">
              <PostAuthor item={item} />
              <Cover item={item} />
              <ResourceFacts kind="events" item={item} />
              <Status value={item.status} />
              <p>
                {item.mode === "recap" ? "Past event / Recap — no registration" : `${item.participants} of ${item.capacity} places reserved`}
              </p>
              <p className="preserve"><LinkedText text={item.description} /></p>
              <ContactNumber
                number={item.contactNumber}
                label="Event organizer"
              />
              {item.mode !== "recap" && !admin(user) &&
                (item.registered ? (
                  <Action
                    run={async () => {
                      await api.patch(`/events/${id}/registrations`, {
                        user: user._id,
                        status: "cancelled",
                      });
                      reload();
                    }}
                  >
                    Cancel my registration
                  </Action>
                ) : (
                  <Action
                    className="primary"
                    run={async () => {
                      setConfirm(true);
                    }}
                  >
                    Participate in event
                  </Action>
                ))}
              {item.mode !== "recap" && (admin(user) || String(item.owner?._id || item.owner) === user._id) && (
                <button className="primary" onClick={() => setShow(!show)}>
                  Manage participants
                </button>
              )}
              {item.mode !== "recap" && <p className="muted">
                Times are shown in your device’s timezone. Confirm to reserve
                your place. Removed registrations free a place immediately.
              </p>}
            </article>
            {show && <Participants id={id} onChanged={reload} />}
          </div>
          {confirm && (
            <BookingConfirm
              id={id}
              onClose={() => setConfirm(false)}
              onBooked={() => {
                setConfirm(false);
                reload();
              }}
            />
          )}
        </>
      )}
    </>
  );
}
function BookingConfirm({ id, onClose, onBooked }) {
  const { user, setUser } = useAuth();
  return (
    <Modal title="Confirm your participation" onClose={onClose}>
      <p>
        Your name, email, university ID and contact number will be shared with
        the event organizer.
      </p>
      <div className="booking-identity">
        <strong>{user.name}</strong>
        <span>{user.email}</span>
        <span>{user.universityId}</span>
      </div>
      <Form
        fields={[{ name: "phone", label: "Contact number", type: "tel" }]}
        initial={{ phone: user.phone || "" }}
        submit="Confirm participation"
        onSubmit={async (values) => {
          if (values.phone !== user.phone) {
            const r = await api.patch("/users/me", { phone: values.phone });
            setUser(r.data.user);
          }
          await api.post("/events/" + id + "/register");
          onBooked();
        }}
      />
    </Modal>
  );
}
function Participants({ id, onChanged }) {
  const [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [selected, setSelected] = useState(""),
    { data, error, loading, reload } = useLoad(
      "/events/" + id + "/participants?page=" + page,
    ),
    { data: members } = useLoad(
      "/events/" + id + "/member-options?q=" + encodeURIComponent(q),
    );
  return (
    <section className="card participant-manager">
      <span className="eyebrow">ORGANIZER WORKSPACE</span>
      <h2>Manage participants</h2>
      <p>
        {data?.total || 0} active bookings · removing a participant immediately
        opens a place.
      </p>
      <div className="participant-add">
        <label>
          Find an existing member
          <input
            aria-label="Find participant"
            value={q}
            placeholder="Name, email or university ID"
            onChange={(e) => {
              setQ(e.target.value);
              setSelected("");
            }}
          />
        </label>
        <label>
          Select member
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a member…</option>
            {members?.items
              .map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name} · {m.universityId}
                </option>
              ))}
          </select>
        </label>
        <Action
          className="primary"
          run={async () => {
            if (!selected) throw Error("Select a member first");
            await api.post("/events/" + id + "/participants", {
              user: selected,
            });
            setSelected("");
            reload();
            onChanged();
          }}
        >
          Add participant
        </Action>
        <small>The member needs a valid phone number in their profile.</small>
      </div>
      <Notice error={error} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        data.items.map((row) => (
          <div className="participant-row" key={row.user?._id}>
            <Avatar user={row.user} />
            <div>
              <strong>{row.snapshot?.name || row.user?.name}</strong>
              <small>{row.snapshot?.email || row.user?.email}</small>
              <small>
                ID: {row.snapshot?.universityId || row.user?.universityId}
              </small>
              <ContactNumber
                number={row.snapshot?.phone || row.user?.phone}
                compact
              />
            </div>
            <Action
              run={async () => {
                await api.patch("/events/" + id + "/registrations", {
                  user: row.user._id,
                  status: "cancelled",
                });
                reload();
                onChanged();
              }}
            >
              Remove participation
            </Action>
          </div>
        ))
      ) : (
        <Empty>No participants yet.</Empty>
      )}
      <Pager {...{ data, page, setPage }} numbered />
    </section>
  );
}
function DonationPayment({ item, onChanged }) {
  const [sent, setSent] = useState(false), [selected,setSelected]=useState(""), [copyError,setCopyError]=useState("");
  const wallets = [["bkash", "bKash", item.bkashNumber], ["nagad", "Nagad", item.nagadNumber]].filter(([, ,number])=>number);
  if (!wallets.length) return <section className="card donation-payment"><h2>Payment details coming soon</h2><p>The owner needs to add a bKash or Nagad receiving number before members can submit a donation.</p></section>;
  return <section className="donation-payment card">
    <span className="eyebrow">MAKE A CONTRIBUTION</span><h2>Small acts. Real impact.</h2>
    <p>Select a wallet to copy the receiving number. Complete your payment in your own wallet app, then submit the transaction ID below.</p>
    <div className="donation-methods">{wallets.map(([key,name,number])=><button type="button" className={`donation-wallet ${key} ${selected===key?"selected":""}`} key={key} onClick={async()=>{setSelected(key);setCopyError("");try {await navigator.clipboard.writeText(number);}catch{setCopyError("Could not copy automatically. Select and copy the receiving number below.");}}}><span className="wallet-icon" aria-hidden="true"><HeartHandshake size={25}/></span><strong>{name}</strong><span>{number}</span><small>{selected===key?"Selected · receiving number":"Click to copy receiving number"}</small></button>)}</div>
    <Notice error={copyError}/>
    {selected&&<div className="wallet-payment-guide"><strong>Continue in your {selected==="bkash"?"bKash":"Nagad"} app</strong><p>Use the owner’s receiving number and payment instructions above. Confirm the recipient’s name and amount before sending. Copy the successful transaction ID, then submit it below. Your wallet PIN and OTP stay in your wallet app.</p></div>}
    {sent && <div className="success" role="status">Submitted for review. The amount will count after the owner verifies and approves your payment.</div>}
    <Form key={selected || "wallet"} initial={{method:selected || wallets[0][0]}} fields={[{name:"method",label:"Payment method",options:wallets.map(([value,label])=>({value,label}))},{name:"amount",label:"Amount paid (BDT)",type:"number",min:1,max:100000000,step:0.01},{name:"reference",label:"Successful transaction ID"}]} submit="Submit donation for review" onSubmit={async values=>{await api.post(`/donations/${item._id}/contributions`,values);setSent(true);onChanged();}} />
  </section>;
}
function DonationContributors({ id, onChanged }) {
  const [page,setPage]=useState(1), {data,error,loading,reload}=useLoad(`/donations/${id}/contributions?page=${page}`);
  useEffect(()=>{const timer=setInterval(()=>{if(!document.hidden)reload();},20000);return()=>clearInterval(timer);},[id,page]);
  return <section className="card donation-ledger"><div className="row between"><div><span className="eyebrow">OWNER WORKSPACE · PRIVATE</span><h2>Contributions & payment review</h2></div><button onClick={()=>{reload();onChanged();}}>Refresh</button></div>
    <p>Confirm the payment in your wallet, bank statement or verified gateway record before approving. Pending and rejected payments do not count.</p>
    <div className="donation-review-summary">{["pending","approved","rejected"].map(status=>{const sum=data?.summary.find(x=>x._id===status);return <div key={status}><Status value={status}/><strong>{money(sum?.amount || 0)}</strong><small>{sum?.count || 0} contributions</small></div>;})}</div>
    <Notice error={error}/>{loading&&!data ? <Loading/> : data?.items.length ? <div className="contributor-list">{data.items.map(row=><article className="contributor-row" key={row._id}><div><strong>{row.user?.name || row.donorName || "Guest donor"}</strong><small>{row.user?.email || row.donorEmail} {row.user?.universityId && `· ID ${row.user.universityId}`}</small><small>{row.user?.phone || row.donorPhone}</small><span>{row.method === "card" ? "Hosted online checkout" : row.method} · {row.reference}</span><small>{date(row.createdAt)} · Payment: {row.paymentStatus || "submitted"}</small></div><div className="contributor-decision"><strong>{money(row.amount)}</strong><Status value={row.status}/>{row.status==="pending" && !["awaiting_gateway","failed"].includes(row.paymentStatus) && <div className="row">{["approved","rejected"].map(status=><Action key={status} run={async()=>{await api.patch(`/contributions/${row._id}`,{status});reload();onChanged();}}>{status==="approved"?"Approve payment":"Reject"}</Action>)}</div>}{row.reviewedAt&&<small>Reviewed {date(row.reviewedAt)}</small>}</div></article>)}</div> : <Empty>No contributions yet.</Empty>}<Pager {...{data,page,setPage}} numbered/>
  </section>;
}
function DonationDetails() {
  const { id } = useParams(),
    { user } = useAuth(),
    { data, error, loading, reload } = useLoad(`/donations/${id}`);
  useEffect(()=>{const timer=setInterval(()=>{if(!document.hidden)reload();},20000);return()=>clearInterval(timer);},[id]);
  if (loading && !data) return <Loading />;
  const item = data?.item;
  return (
    <>
      <Notice error={error} />
      {item && (
        <>
          <Head
            title={item.title}
            description="A community contribution, a lasting impact."
          />
          <ResourceTools kind="donations" item={item} reload={reload} />
          <article className="card detail">
            <PostAuthor item={item} />
            <Cover item={item} />
            <ResourceFacts kind="donations" item={item} />
            <Status value={item.status} />
            {item.mode !== "information" && <div className="donation-progress-panel"><div><span>APPROVED CONTRIBUTIONS</span><h2>{money(data.total)} <small>raised of {money(item.goal)}</small></h2></div><progress value={Math.min(data.total,item.goal)} max={item.goal}/><div className="row between"><strong>{money(Math.max(0,item.goal-data.total))} remaining</strong><span>{Math.min(100,Math.round(data.total/item.goal*100))}% funded</span></div><small>Only reviewed and approved donations are counted.</small></div>}
            <p className="preserve"><LinkedText text={item.description} /></p>
            <ContactNumber
              number={item.contactNumber}
              label="Campaign contact"
            />
            <h3>{item.mode === "information" ? "Official help and contact" : "How to contribute"}</h3>
            <p className="preserve"><LinkedText text={item.instructions} /></p>
          </article>
          {item.mode !== "information" && item.status === "open" && String(item.owner?._id || item.owner) !== user._id && <DonationPayment item={item} onChanged={reload}/>}
          {(admin(user) || String(item.owner?._id || item.owner) === user._id) && <DonationContributors id={id} onChanged={reload}/>}
        </>
      )}
    </>
  );
}
function Contributions() {
  const { user } = useAuth(),
    [page, setPage] = useState(1),
    { data, error, loading, reload } = useLoad(`/contributions?page=${page}`);
  return (
    <section className="card">
      <h2>
        {admin(user) ? "Review contributions" : "Your contribution history"}
      </h2>
      <Notice error={error} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        data.items.map((item) => (
          <div className="table-row" key={item._id}>
            <div>
              <strong>{item.donation?.title}</strong>
              <small>
                {item.user?.name} · {item.reference}
              </small>
            </div>
            <strong>{money(item.amount)}</strong>
            <Status value={item.status} />
            {admin(user) && item.status === "pending" && (
              <div className="row">
                {["approved", "rejected"].map((status) => (
                  <Action
                    key={status}
                    run={async () => {
                      await api.patch(`/contributions/${item._id}`, { status });
                      reload();
                    }}
                  >
                    {status === "approved" ? "Approve" : "Reject"}
                  </Action>
                ))}
              </div>
            )}
          </div>
        ))
      ) : (
        <Empty />
      )}
      <Pager {...{ data, page, setPage }} />
    </section>
  );
}

export { Resources, JobDetails, EventDetails, DonationDetails };
