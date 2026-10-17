import { loginDestination } from "../route-access.js";
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
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
function Login() {
  const { user, setUser } = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  if (user) return <Navigate to={loginDestination()} replace />;
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">GROW TOGETHER</span>
          <h1>
            A connection today.
            <br />A possibility tomorrow.
          </h1>
          <p>Your university journey doesn’t end at graduation.</p>
        </div>
        <span className="muted">Mentorship · Careers · Community</span>
      </div>
      <main className="auth-form">
        <span className="eyebrow">WELCOME TO YOUR COMMUNITY</span>
        <h1>Good to see you again.</h1>
        <p>
          Sign in with the email or university ID and password provided by your
          Administrator.
        </p>
        <Form
          fields={[
            { name: "identifier", label: "Email or university ID" },
            { name: "password", type: "password" },
          ]}
          submit="Sign in"
          onSubmit={async (values) => {
            const response = await api.post("/auth/login", values);
            setUser(response.data.user);
            navigate(loginDestination(), { replace: true });
          }}
        />
        <div className="login-recovery">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <p className="muted">
          Accounts are created by university Administrators. Contact your
          university office for a new account or account recovery.
        </p>
      </main>
    </div>
  );
}
function Dashboard() {
  const { user } = useAuth(),
    { data, loading, error } = useLoad("/dashboard");
  if (loading) return <Loading />;
  return (
    <>
      <Head
        eyebrow={`${user.role.toUpperCase()} WORKSPACE`}
        title={`Welcome back, ${user.name.split(" ")[0]}.`}
        description="A little connection can open a world of possibility."
      />
      <Notice error={error} />
      <section className="hero-banner">
        <div>
          <div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div>
          <h2>
            Great journeys.
            <br />
            <span>Stronger connections.</span>
          </h2>
          <p>
            Find guidance, share what you know, and build
            <br className="desktop" /> what comes next — together.
          </p>
          <Link
            className="button primary"
            to={admin(user) ? "/app/users" : "/app/mentors"}
          >
            {admin(user) ? "Manage your community" : "Explore your mentors"}{" "}
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="orbit-art" aria-hidden="true">
          <div className="orbit o1" />
          <div className="orbit o2" />
          <div className="orbit o3" />
          <span className="orbit-center">
            <GraduationCap size={47} />
          </span>
          <span className="orbit-node n1">
            <Users size={25} />
          </span>
          <span className="orbit-node n2">
            <BriefcaseBusiness size={24} />
          </span>
          <span className="orbit-node n3">
            <HeartHandshake size={24} />
          </span>
          <span className="orbit-label">
            A network for life <Sparkles size={14} />
          </span>
        </div>
      </section>
      <div className="stats-grid">
        {[
          [
            admin(user) ? data?.stats.users : data?.stats.mentorships,
            admin(user) ? "Community members" : "Active mentorships",
            Users,
            "requests",
          ],
          [data?.stats.jobs, "Open opportunities", BriefcaseBusiness, "jobs"],
          [data?.stats.events, "Upcoming events", CalendarDays, "events"],
          [
            data?.stats.notifications,
            "Unread notifications",
            Bell,
            "notifications",
          ],
        ].map(([value, label, Icon, path]) => (
          <Link
            to={`/app/${admin(user) && path === "requests" ? "users" : path}`}
            className="stat-card"
            key={label}
          >
            <span className="stat-icon">
              <Icon size={20} />
            </span>
            <ArrowUpRight className="stat-arrow" size={17} />
            <strong>{value ?? "—"}</strong>
            <span>{label}</span>
          </Link>
        ))}
      </div>
      <div className="dashboard-columns">
        <section>
          <div className="section-title">
            <h2>From your community</h2>
            <Link to="/app/feed">
              View newsfeed <ArrowRight size={15} />
            </Link>
          </div>
          {data?.recent.length ? (
            data.recent.map((post) => (
              <article className="card feed-card" key={post._id}>
                <div className="row">
                  <Avatar user={post.author} />
                  <div>
                    <strong>{post.author?.name || "Former member"}</strong>
                    <small>
                      {post.author?.role} · {date(post.createdAt)}
                    </small>
                  </div>
                </div>
                <p className="preserve">{post.body}</p>
              </article>
            ))
          ) : (
            <Empty>Be the first to share something with your community.</Empty>
          )}
        </section>
        <aside>
          <div className="section-title">
            <h2>Make your next move</h2>
          </div>
          <div className="card quick-links">
            {[
              [
                "mentors",
                "Find your people",
                "Learn from those who have been there.",
                Users,
              ],
              [
                "events",
                "Be part of something",
                "Discover what’s happening on campus.",
                CalendarDays,
              ],
              [
                "donations",
                "Make a difference",
                "Support a cause in your community.",
                HeartHandshake,
              ],
            ].map(([p, title, desc, Icon]) => (
              <Link to={`/app/${p}`} key={p}>
                <Icon size={22} />
                <div>
                  <strong>{title}</strong>
                  <p>{desc}</p>
                </div>
                <ChevronRight size={18} />
              </Link>
            ))}
          </div>
          <div className="note-card">
            <span className="eyebrow">A SMALL STEP, A BIG DIFFERENCE</span>
            <h3>Your story is still unfolding.</h3>
            <p>
              Keep your profile up to date so the right people can find you.
            </p>
            <Link to="/app/profile">
              Update your profile <ArrowUpRight size={15} />
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
function Feed() {
  const { user } = useAuth(),
    [page, setPage] = useState(1),
    { data, loading, error, reload } = useLoad(`/posts?page=${page}`),
    [editing, setEditing] = useState(null);
  return (
    <>
      <Head
        title="The community feed"
        description="Ideas, milestones, and conversations from people you know."
      />
      <div className="card composer">
        <Form
          fields={[
            {
              name: "body",
              label: "Share with your community",
              area: true,
              max: 5000,
            },
          ]}
          submit="Publish post"
          onSubmit={async (values) => {
            await api.post("/posts", values);
            reload();
          }}
        />
      </div>
      <Notice error={error} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        data.items.map((post) => (
          <article className="card feed-card" key={post._id}>
            <div className="row between">
              <div className="row">
                <Avatar user={post.author} />
                <div>
                  <strong>{post.author?.name || "Former member"}</strong>
                  <small>
                    {post.author?.role} · {date(post.createdAt)}
                  </small>
                </div>
              </div>
              {(String(post.author?._id) === user._id || admin(user)) && (
                <div className="row">
                  <button onClick={() => setEditing(post)}>Edit</button>
                  <Action
                    run={async () => {
                      await api.delete(`/posts/${post._id}`);
                      reload();
                    }}
                  >
                    Delete
                  </Action>
                </div>
              )}
            </div>
            <p className="preserve">{post.body}</p>
          </article>
        ))
      ) : (
        <Empty />
      )}
      <Pager {...{ data, page, setPage }} />
      {editing && (
        <Modal title="Edit post" onClose={() => setEditing(null)}>
          <Form
            fields={[{ name: "body", area: true, max: 5000 }]}
            initial={editing}
            onSubmit={async (v) => {
              await api.patch(`/posts/${editing._id}`, v);
              setEditing(null);
              reload();
            }}
          />
        </Modal>
      )}
    </>
  );
}
function Mentors() {
  const { user } = useAuth(),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    { data, loading, error, reload } = useLoad(
      `/mentors?q=${encodeURIComponent(q)}&page=${page}`,
    ),
    [submitted, setSubmitted] = useState({}),
    [selected, setSelected] = useState(null),
    [sent, setSent] = useState("");
  useEffect(() => { setSubmitted({}); }, [data]);
  useEffect(() => { const timer = setInterval(reload, 15000); return () => clearInterval(timer); }, [q, page]);
  const relationFor = u => submitted[u._id] || data?.items.find(item => item._id === u._id)?.mentorship || u.mentorship;
  const relationLabel = r => ({pending:"Request pending",accepted:"Mentorship accepted",rejected:"Request declined",completed:"Mentorship completed"}[r?.status]);
  return (
    <>
      <Head
        title="A little guidance. A big possibility."
        description="Connect with alumni who understand where you are — and where you want to go."
      />
      <div className="search-box">
        <Search size={19} />
        <input
          aria-label="Search mentors"
          placeholder="Search name, company, or department…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {sent && (
        <div className="success" role="status">
          {sent}
        </div>
      )}
      <Notice error={error} />
      {loading && !data ? (
        <Loading />
      ) : (
        <div className="cards-grid">
          {data?.items.map((u) => (
            <article className="card mentor-card" key={u._id}>
              <span className={`status mentor-request-status ${relationFor(u)?.status || "available"}`}>{relationLabel(relationFor(u)) || "Open to mentorship"}</span>
              <Avatar user={u} large />
              <h2>{u.name}</h2>
              <p>
                {u.position || "Alumni mentor"}
                {u.company && ` at ${u.company}`}
              </p>
              <small>
                {u.department}
                {u.graduationYear && ` · Class of ${u.graduationYear}`}
              </small>
              <p className="preserve">
                {u.bio || "Connect to learn more about their journey."}
              </p>
              <div className="tags">
                {u.skills?.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
              <button className="wide" onClick={() => setSelected(u)}>
                View profile <ArrowUpRight size={16} />
              </button>
            </article>
          ))}
        </div>
      )}
      {!loading && !data?.items.length && (
        <Empty>No mentors match your search.</Empty>
      )}
      <Pager {...{ data, page, setPage }} />
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <Link className="button primary" to={"/app/members/" + selected._id}>
            View Alumni profile <ArrowUpRight size={15} />
          </Link>
          <p>{selected.bio}</p>
          <p className="preserve">{selected.experience}</p>
          {selected.linkedin && (
            <a href={selected.linkedin} target="_blank" rel="noreferrer">
              Professional profile <ArrowUpRight size={14} />
            </a>
          )}
          {["student", "alumni"].includes(user.role) && relationFor(selected) ? (
            <div className="note-card"><p>{relationLabel(relationFor(selected))}</p>
              {relationFor(selected).status === "accepted" && <Link className="button primary" to={"/app/messages/" + relationFor(selected)._id}>Message mentor</Link>}
            </div>
          ) : ["student", "alumni"].includes(user.role) ? (
            <Form
              fields={[
                { name: "title", label: "What would you like guidance on?" },
                {
                  name: "description",
                  label: "Introduce yourself and your goals",
                  area: true,
                  max: 3000,
                },
              ]}
              submit="Request mentorship"
              onSubmit={async (v) => {
                const result = await api.post("/mentorships", { ...v, mentor: selected._id });
                setSubmitted(previous => ({ ...previous, [selected._id]: result.data.item }));
                reload();
                setSelected(null);
                setSent("Your mentorship request has been sent.");
              }}
            />
          ) : (
            <p>Mentorship requests are available to Students and Alumni.</p>
          )}
        </Modal>
      )}
    </>
  );
}
function Requests() {
  const { user } = useAuth(),
    [page, setPage] = useState(1),
    { data, error, loading, reload } = useLoad(`/mentorships?page=${page}`);
  return (
    <>
      <Head
        title="Grow, together."
        description="Your mentorship requests and connections, all in one place."
      />
      <Notice error={error} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        data.items.map((item) => {
          const other =
            String(item.student?._id) === user._id ? item.mentor : item.student;
          return (
            <article className="card" key={item._id}>
              <div className="row between">
                <div className="row">
                  <Avatar user={other} />
                  <div>
                    <h2>{item.title}</h2>
                    <small>
                      {other?.name} · {other?.department}
                      <span> · You are the {String(item.mentor?._id) === user._id ? "mentor" : "mentee"}</span>
                    </small>
                  </div>
                </div>
                <Status value={item.status} />
              </div>
              <p className="preserve">{item.description}</p>
              <div className="actions">
                {item.closedForConversion && item.status === "completed" && (
                  <Link className="button" to={"/app/archives/" + item._id}>
                    View archived conversation
                  </Link>
                )}
                {String(item.mentor?._id) === user._id &&
                  item.status === "pending" &&
                  ["accepted", "rejected"].map((status) => (
                    <Action
                      key={status}
                      run={async () => {
                        await api.patch(`/mentorships/${item._id}`, { status });
                        reload();
                      }}
                    >
                      {status === "accepted" ? "Accept request" : "Decline"}
                    </Action>
                  ))}
                {item.status === "completed" && !item.closedForConversion && <Link className="button" to={`/app/messages/${item._id}`}>View conversation history</Link>}
                {item.status === "accepted" && (
                  <>
                    <Link
                      className="button primary"
                      to={`/app/messages/${item._id}`}
                    >
                      Open conversation
                    </Link>
                    {String(item.mentor?._id) === user._id && <Action
                      run={async () => {
                        await api.patch(`/mentorships/${item._id}`, {
                          status: "completed",
                        });
                        reload();
                      }}
                    >
                      Complete mentorship
                    </Action>}
                  </>
                )}
              </div>
            </article>
          );
        })
      ) : (
        <Empty>
          No mentorship requests yet. Your next connection is a step away.
        </Empty>
      )}
      <Pager {...{ data, page, setPage }} />
    </>
  );
}
function Messages() {
  const [search,setSearch] = useState("");
  const { user } = useAuth(),
    { id } = useParams(),
    { data, loading, error, reload } = useLoad("/conversations");
  useEffect(() => { if (!["student", "alumni"].includes(user.role)) return; const timer = setInterval(reload, 15000); return () => clearInterval(timer); }, [user.role]);
  if (!["student", "alumni"].includes(user.role))
    return (
      <>
        <Head title="Messages" />
        <Empty>
          Messaging is available to Students and Alumni through their accepted Alumni
          mentors.
        </Empty>
      </>
    );
  return (
    <>
      <Head
        title="Meaningful conversations"
        description="A space for you and your accepted mentorship connections."
      />
      <Notice error={error} />
      {loading && !data ? (
        <Loading />
      ) : (
        <div className={`messaging premium-messaging ${id ? "has-conversation" : ""}`}>
          <aside className="contact-list">
            <div className="inbox-heading"><span className="eyebrow">YOUR INNER CIRCLE</span><h3>Conversations <small>{data?.items.length || 0}</small></h3><input aria-label="Search conversations" placeholder="Find a connection…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
            {data?.items.length ? (
              data.items.filter(item => [item.student?.name,item.mentor?.name,item.title].join(" ").toLowerCase().includes(search.toLowerCase())).map((item) => {
                const other =
                  String(item.student?._id) === user._id ? item.mentor : item.student;
                return (
                  <NavLink key={item._id} to={`/app/messages/${item._id}`}>
                    <Avatar user={other} />
                    <div>
                      <strong>{other?.name}</strong>
                      <small className="connection-role">{String(item.mentor?._id) === user._id ? "Your mentee" : "Your mentor"}{item.status === "completed" ? " · Completed" : ""}</small><small className="last-message">{item.lastMessage?.deletedAt ? "Message deleted" : item.lastMessage?.body?.slice(0,70) || item.title}</small>
                    </div>
                  </NavLink>
                );
              })
            ) : (
              <Empty>{"Accepted connections appear here. As a mentee, wait for your mentor’s first message; as a mentor, send the first message to open the conversation."}</Empty>
            )}
          </aside>
          <section className="conversation">
            {id ? (
              <Conversation key={id} id={id} />
            ) : (
              <Empty>Select a connection to start a conversation.</Empty>
            )}
          </section>
        </div>
      )}
    </>
  );
}
function Conversation({ id }) {
  const { user } = useAuth(), [page,setPage]=useState(1), [body,setBody]=useState(""), [sending,setSending]=useState(false), [actionError,setActionError]=useState(""), [deleting,setDeleting]=useState(null);
  const {data,error,loading,reload}=useLoad(`/conversations/${id}/messages?page=${page}`);
  const history=useRef(null), follow=useRef(true);
  useEffect(()=>{const timer=setInterval(()=>{if(!document.hidden)reload();},10000);return()=>clearInterval(timer);},[id,page]);
  useEffect(()=>{if(page===1&&follow.current&&history.current)history.current.scrollTop=history.current.scrollHeight;},[data,page]);
  const send=async()=>{if(!body.trim()||sending)return;setSending(true);setActionError("");try{await api.post(`/conversations/${id}/messages`,{body:body.trim()});setBody("");follow.current=true;setPage(1);reload();}catch(err){setActionError(errorText(err));}finally{setSending(false);}};
  return <div className="premium-conversation">
    <header className="chat-header"><Link className="chat-back" to="/app/messages" aria-label="Back to conversations">←</Link><Avatar user={data?.counterpart}/><div><Link to={data?.counterpart?._id ? `/app/members/${data.counterpart._id}` : "/app/messages"}><strong>{data?.counterpart?.name || "Conversation"}</strong></Link><small>{data?.relationship?.isMentor ? "Your mentee" : "Your Alumni mentor"} · {data?.relationship?.status === "completed" ? "Completed · Read only" : "Mentorship connection"}</small></div><span className="chat-security"><ShieldCheck size={15}/> Private</span></header>
    <Notice error={error||actionError}/>
    <div className="chat-topic"><HeartHandshake size={14}/><span>{data?.relationship?.title || "A little guidance. A meaningful connection."}</span></div>
    <div className="message-history premium-history" ref={history} onScroll={()=>{const el=history.current;if(el)follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<100;}}>
      {loading&&!data ? <Loading/> : data?.items.length ? [...data.items].reverse().map((m,index,list)=>{
        const mine=String(m.sender?._id)===user._id;
        const day=new Date(m.createdAt).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
        const showDay=index===0||new Date(list[index-1].createdAt).toDateString()!==new Date(m.createdAt).toDateString();
        return <React.Fragment key={m._id}>{showDay&&<div className="chat-day"><span>{day}</span></div>}<div className={`chat-message-row ${mine?"outgoing":"incoming"}`}><article className={`chat-bubble ${m.deletedAt?"deleted":""}`}><p>{m.deletedAt?"This message was deleted":m.body}</p><div className="chat-message-meta"><time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}</time>{mine&&!m.deletedAt&&<Check size={12}/>} {mine&&!m.deletedAt&&data.canSend&&<button className="delete-chat-message" type="button" aria-label="Delete your message" onClick={()=>setDeleting(m)}>Delete</button>}</div></article></div></React.Fragment>;
      }) : !error&&<div className="chat-welcome"><MessagesSquare size={34}/><h3>A conversation worth starting.</h3><p>{data?.relationship?.isMentor?"Welcome your mentee and ask how you can help.":"Share your questions, goals and next steps with your mentor."}</p></div>}
    </div>
    <Pager {...{data,page,setPage}}/>
    {!error&&data?.waitingForMentor&&<div className="chat-state-note"><Clock size={17}/>Your mentor will send the first message. You can reply after that.</div>}
    {!error&&data?.relationship?.status==="completed"&&<div className="chat-state-note"><ShieldCheck size={17}/>Mentorship completed. Your conversation history is read only.</div>}
    {!error&&data?.canSend&&<form className="premium-composer" onSubmit={e=>{e.preventDefault();send();}}><label className="sr-only" htmlFor="chat-message">Your message</label><textarea id="chat-message" value={body} disabled={sending} maxLength={4000} placeholder={data.relationship.isMentor?"Share a thought. Offer a little guidance…":"Ask a question. Share your next step…"} onChange={e=>setBody(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send();}}} rows={2}/><div className="composer-footer"><small>Enter to send · Shift + Enter for a new line<span>{body.length}/4000</span></small><button className="primary" type="submit" disabled={sending||!body.trim()}><Send size={17}/>{sending?"Sending…":"Send"}</button></div></form>}
    {deleting&&<Modal title="Delete this message?" onClose={()=>setDeleting(null)}><p>The message content will be removed for both people. A deleted-message label will remain in the conversation.</p><div className="actions"><button onClick={()=>setDeleting(null)}>Keep message</button><Action run={async()=>{await api.delete(`/conversations/${id}/messages/${deleting._id}`);setDeleting(null);reload();}}>Delete message</Action></div></Modal>}
  </div>;
}

export { Login, Dashboard, Feed, Mentors, Requests, Messages };
