import {listKey,readListPosition} from "../lib/listNavigation.js";
import {useListReturn} from "../lib/useListReturn.js";
import { ChatAttachments } from "../components/ChatAttachment.jsx";
import { NetworkScene } from "./Landing.jsx";
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
  Paperclip,
  FileText,
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
} from "../components/ui.jsx";
function Login() {
  const { user, setUser } = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  if (user) return <Navigate to={loginDestination()} replace />;
  return (
    <div className="auth-page login-page login-unified">
      <div className="login-background-scene" aria-hidden="true"><NetworkScene /></div>
      <div className="auth-story">
        <Brand />
        <div className="login-story-content">
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
          Sign in with the Email and password provided by your
          Administrator.
        </p>
        <Form
          fields={[
            { name: "identifier", label: "Email" },
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
  const roleHero = {
    student: { tag: "YOUR NEXT CHAPTER", title: "Find your direction.", accent: "Grow with guidance.", text: "Connect with alumni mentors and discover opportunities for your future.", label: "Find a mentor", path: "/app/mentors", Icon: GraduationCap, orbit: "LEARN & GROW" },
    alumni: { tag: "YOUR EXPERIENCE MATTERS", title: "Share your journey.", accent: "Inspire what comes next.", text: "Support fellow members, exchange guidance and share new opportunities.", label: "Your mentorships", path: "/app/requests", Icon: HeartHandshake, orbit: "GUIDE & CONNECT" },
    admin: { tag: "YOUR COMMUNITY WORKSPACE", title: "Support your members.", accent: "Keep your community moving.", text: "Manage membership, review requests and help your university community thrive.", label: "Manage members", path: "/app/users", Icon: Users, orbit: "SUPPORT & MANAGE" },
    superadmin: { tag: "YOUR PLATFORM OVERVIEW", title: "Lead with clarity.", accent: "Build lasting connections.", text: "Oversee platform activity, support administrators and guide your community.", label: "Manage administrators", path: "/app/admins", Icon: ShieldCheck, orbit: "LEAD & OVERSEE" },
  }[user.role];
  if (loading) return <Loading />;
  return (
    <div className={`overview-compact dashboard-role-${user.role}`}>
      <div className="dashboard-hero-scene overview-page-orbit welcome-background-orbit" aria-hidden="true">
        <NetworkScene CenterIcon={roleHero.Icon} label={roleHero.orbit}/>
      </div>
      <Notice error={error} />
      <section className={`dashboard-ambient-hero dashboard-role-${user.role}`}>
        <div className="dashboard-hero-copy">
          <div className="eyebrow">{roleHero.tag}</div>
          <h2>{roleHero.title}<br/><span>{roleHero.accent}</span></h2>
          <p>{roleHero.text}</p>
          <Link className="button primary" to={roleHero.path}>{roleHero.label}<ArrowUpRight size={17}/></Link>
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
          [data?.stats.events, "Total events", CalendarDays, "events?mine=false"],
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
    </div>
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
  const navigate=useNavigate(),location=useLocation(),{user}=useAuth(), key=listKey(user,location,"mentors");
  const [savedReturn]=useState(()=>readListPosition(key)?.values);
  const [q,setQ]=useState(savedReturn?.q || ""),[page,setPage]=useState(savedReturn?.page || 1);
  const search=useDebounced(q),{data,loading,error,reload}=useLoad(`/mentors?q=${encodeURIComponent(search)}&page=${page}`);
  const returnRoot=useListReturn(key,{q,page},!loading && !!data);
  const returnState={returnTo:location.pathname,returnLabel:"Find a mentor"};
  useEffect(()=>{const timer=setInterval(()=>{if(!document.hidden)reload();},15000);return()=>clearInterval(timer);},[search,page]);
  const relationFor = u => u.mentorship;
  const relationLabel = r => ({pending:"Request pending",accepted:"Mentorship accepted",rejected:"Request declined",completed:"Mentorship completed"}[r?.status]);
  return (
    <section ref={returnRoot} className="mentor-list-page">
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
      <Notice error={error} onRetry={reload}/>
      {loading && !data ? (
        <Loading />
      ) : (
        <div className="cards-grid">
          {data?.items.map((u) => (
            <article className="card mentor-card" key={u._id}>
              <span className={`status mentor-request-status ${relationFor(u)?.status || "available"}`}>{relationLabel(relationFor(u)) || (u.contactPreference === "open" ? "Open messaging" : "Request first")}</span>
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
              <Link className="button wide" state={returnState} to={`/app/members/${u._id}`}>
                View profile <ArrowUpRight size={16} />
              </Link>
              {u.contactPreference === "open" && !["accepted", "completed"].includes(relationFor(u)?.status) && <Action className="wide primary" run={async () => { const response = await api.post("/direct-conversations", { recipient: u._id }); navigate(`/app/messages/${response.data.item._id}`); }}>Message <MessagesSquare size={16}/></Action>}
            </article>
          ))}
        </div>
      )}
      {!loading && !data?.items.length && (
        <Empty>No mentors match your search.</Empty>
      )}
      <Pager {...{ data, page, setPage }} />
    </section>
  );
}
function Requests() {
  const { user } = useAuth(),
    [page, setPage] = useState(1),
    { data, error, loading, reload } = useLoad(`/mentorships?page=${page}`);
  return (
    <section className="mentorship-workspace">
      <header className="mentorship-heading"><div><span className="eyebrow">GUIDANCE & CONNECTIONS</span><h1>Mentorships</h1><p>{user.role === "alumni" ? "Guide your mentees and keep your mentoring connections close." : "Your mentors, requests and conversations in one place."}</p></div><Link className="button" to="/app/mentors"><Plus size={16}/>Find a mentor<ArrowUpRight size={15}/></Link></header>
      <Notice error={error} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        data.items.map((item) => {
          const other =
            item.type === "direct" ? item.counterpart : String(item.student?._id) === user._id ? item.mentor : item.student;
          return (
            <article className="card mentorship-connection" key={item._id}>
              <div className="mentorship-card-top"><Link className="mentorship-person" to={`/app/members/${other?._id}`}><Avatar user={other}/><div><strong>{other?.name || "Former member"}</strong><small>{[String(item.mentor?._id) === user._id ? "Your mentee" : "Your mentor",other?.department].filter(Boolean).join(" / ")}</small></div></Link><Status value={item.status}/></div>
              <div className="mentorship-request-body"><span className="mentorship-topic-label"><HeartHandshake size={14}/>MENTORSHIP REQUEST</span><h2>{item.title}</h2>{item.description && <p className="preserve">{item.description}</p>}</div>
              <div className="mentorship-card-footer"><span className="mentorship-date">{item.createdAt ? date(item.createdAt) : ""}</span>
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
                      className={status === "accepted" ? "primary" : ""}
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
                      <MessagesSquare size={16}/>Open conversation<ArrowUpRight size={15}/>
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
              </div></div>
            </article>
          );
        })
      ) : (
        <Empty>
          No mentorship requests yet. Your next connection is a step away.
        </Empty>
      )}
      <Pager {...{ data, page, setPage }} />
    </section>
  );
}
function AdministratorContacts({ data, search, id, onOpened }) {
  const navigate = useNavigate(), [busy, setBusy] = useState(""), [error, setError] = useState("");
  const contacts = (data?.contacts || []).filter(contact => `${contact.name} ${contact.role}`.toLowerCase().includes(search.toLowerCase()));
  return <><Notice error={error}/>{contacts.length ? contacts.map(contact => {
    const conversation = data.items.find(item => item.counterpart?._id === contact._id);
    return <button key={contact._id} className={`administrator-contact ${conversation?._id === id ? "active" : ""}`} disabled={!!busy} onClick={async () => {
      setError(""); setBusy(contact._id);
      try {
        const conversationId = conversation?._id || (await api.post("/admin/conversations", { recipient: contact._id })).data.item._id;
        navigate(`/app/messages/${conversationId}`); onOpened();
      } catch (err) { setError(errorText(err)); } finally { setBusy(""); }
    }}><Avatar user={contact}/><div><strong>{contact.name}</strong><small className="connection-role">{contact.role === "superadmin" ? "Super Admin" : "Administrator"}</small>{conversation?.lastMessage && <small className="last-message">{conversation.lastMessage.deletedAt ? "Message deleted" : conversation.lastMessage.body?.slice(0,70) || conversation.lastMessage.attachments?.[0]?.name || conversation.lastMessage.attachment?.name || "Attachment"}</small>}</div>{busy === contact._id && <small>Opening…</small>}</button>;
  }) : <Empty>{search ? "No administrators match your search." : "No other active administrators."}</Empty>}</>;
}
function Messages() {
  const [search,setSearch] = useState("");
  const { user } = useAuth(),
    { id } = useParams(),
    { data, loading, error, reload } = useLoad("/conversations");
  useEffect(() => { if (!["student", "alumni", "admin", "superadmin"].includes(user.role)) return; const timer = setInterval(reload, 15000); return () => clearInterval(timer); }, [user.role]);
  if (!["student", "alumni", "admin", "superadmin"].includes(user.role))
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
        title={admin(user) ? "Administrator messages" : "Meaningful conversations"}
        description={admin(user) ? "Private communication between administrators." : "Your mentorship connections and open conversations."}
      />
      <Notice error={error} />
      {loading && !data ? (
        <Loading />
      ) : (
        <div className={`messaging premium-messaging ${id ? "has-conversation" : ""}`}>
          <aside className="contact-list">
            <div className="inbox-heading"><span className="eyebrow">YOUR INNER CIRCLE</span><h3>{admin(user) ? "Administrators" : "Conversations"} <small>{admin(user) ? data?.contacts?.length || 0 : data?.items.length || 0}</small></h3><input aria-label="Search conversations" placeholder="Find a connection…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
            {admin(user) ? <AdministratorContacts {...{data,search,id}} onOpened={reload}/> : data?.items.length ? (
              data.items.filter(item => [item.counterpart?.name,item.student?.name,item.mentor?.name,item.title].join(" ").toLowerCase().includes(search.toLowerCase())).map((item) => {
                const other = item.type === "direct"
                  ? item.counterpart
                  : String(item.student?._id) === String(user._id) ? item.mentor : item.student;
                return (
                  <NavLink key={item._id} to={`/app/messages/${item._id}`}>
                    <Avatar user={other} />
                    <div>
                      <strong>{other?.name}</strong>
                      <small className="connection-role">{item.type === "direct" ? "Direct conversation" : String(item.mentor?._id) === user._id ? "Your mentee" : "Your mentor"}{item.status === "completed" ? " · Completed" : ""}</small><small className="last-message">{item.lastMessage?.deletedAt ? "Message deleted" : item.lastMessage?.body?.slice(0,70) || item.lastMessage?.attachments?.[0]?.name || item.lastMessage?.attachment?.name || item.title}</small>
                    </div>
                  </NavLink>
                );
              })
            ) : (
              <Empty>{"Mentorship conversations and Alumni open chats appear here. Find a mentor or open an Alumni profile to connect."}</Empty>
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
  const { user } = useAuth(), [page,setPage]=useState(1), [body,setBody]=useState(""), [sending,setSending]=useState(false), [actionError,setActionError]=useState(""), [deleting,setDeleting]=useState(null), [attachments,setAttachments]=useState([]), [attachmentPreviews,setAttachmentPreviews]=useState([]), [uploadProgress,setUploadProgress]=useState(0);
  const {data,error,loading,reload}=useLoad(`/conversations/${id}/messages?page=${page}`);
  const history=useRef(null), follow=useRef(true);
  useEffect(()=>{const timer=setInterval(()=>{if(!document.hidden)reload();},10000);return()=>clearInterval(timer);},[id,page]);
  useEffect(()=>{if(page===1&&follow.current&&history.current)history.current.scrollTop=history.current.scrollHeight;},[data,page]);
  useEffect(() => {
    const previews = attachments.map(file => file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
    setAttachmentPreviews(previews);
    return () => previews.forEach(url => { if(url) URL.revokeObjectURL(url); });
  }, [attachments]);
  const chooseAttachment = event => {
    const chosen = [...(event.target.files || [])]; event.target.value = "";
    if (!chosen.length) return;
    const next = [...attachments, ...chosen];
    if (next.length > 5 || next.reduce((sum,file)=>sum+file.size,0)>25*1024*1024 || next.some(file=>!file.size || file.size>10*1024*1024 || !/\.(jpe?g|png|webp|pdf)$/i.test(file.name))) {
      setActionError("Choose up to 5 JPG, PNG, WebP or PDF files: 10 MB each, 25 MB total."); return;
    }
    setActionError(""); setAttachments(next);
  };
  const send = async () => {
    if ((!body.trim() && !attachments.length) || sending || !data?.canSend) return;
    setSending(true); setActionError(""); setUploadProgress(0);
    try {
      if (attachments.length) {
        const form = new FormData(); attachments.forEach(file => form.append("files",file)); form.append("body",body.trim());
        await api.post(`/conversations/${id}/attachments`,form,{onUploadProgress:event=>setUploadProgress(event.total ? Math.round(event.loaded/event.total*100) : 0)});
      } else await api.post(`/conversations/${id}/messages`,{body:body.trim()});
      setBody(""); setAttachments([]); follow.current=true; setPage(1); reload();
    } catch(err) { setActionError(errorText(err)); } finally { setSending(false); }
  };
  return <div className="premium-conversation">
    <header className="chat-header"><Link className="chat-back" to="/app/messages" aria-label="Back to conversations">←</Link><Avatar user={data?.counterpart}/><div><Link to={data?.counterpart?._id ? `/app/members/${data.counterpart._id}` : "/app/messages"}><strong>{data?.counterpart?.name || "Conversation"}</strong></Link><small>{data?.relationship?.type === "direct" ? (data.relationship.audience === "admins" ? data.counterpart?.role === "superadmin" ? "Super Admin" : "Administrator" : "Community member") : data?.relationship?.isMentor ? "Your mentee" : "Your Alumni mentor"} · {data?.relationship?.status === "completed" ? "Completed · Read only" : data?.relationship?.type === "direct" ? "Direct conversation" : "Mentorship connection"}</small></div><span className="chat-security"><ShieldCheck size={15}/> Private</span></header>
    <Notice error={error||actionError}/>
    {data?.relationship?.audience !== "admins" && <div className="chat-topic"><HeartHandshake size={14}/><span>{data?.relationship?.title || "A little guidance. A meaningful connection."}</span></div>}
    <div className="message-history premium-history" ref={history} onScroll={()=>{const el=history.current;if(el)follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<100;}}>
      {loading&&!data ? <Loading/> : data?.items.length ? [...data.items].reverse().map((m,index,list)=>{
        const mine=String(m.sender?._id)===user._id;
        const day=new Date(m.createdAt).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
        const showDay=index===0||new Date(list[index-1].createdAt).toDateString()!==new Date(m.createdAt).toDateString();
        return <React.Fragment key={m._id}>{showDay&&<div className="chat-day"><span>{day}</span></div>}<div className={`chat-message-row ${mine?"outgoing":"incoming"}`}><article className={`chat-bubble ${m.deletedAt?"deleted":""}`}>{!m.deletedAt && (m.attachment || m.attachments?.length) && <ChatAttachments message={m} onReady={() => {if(page === 1 && follow.current && history.current) history.current.scrollTop=history.current.scrollHeight;}}/>}<p>{m.deletedAt?"This message was deleted":m.body}</p><div className="chat-message-meta"><time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}</time>{mine&&!m.deletedAt&&<Check size={12}/>} {mine&&!m.deletedAt&&data.canSend&&<button className="delete-chat-message" type="button" aria-label="Delete your message" onClick={()=>setDeleting(m)}>Delete</button>}</div></article></div></React.Fragment>;
      }) : !error&&data?.relationship?.audience !== "admins"&&<div className="chat-welcome"><MessagesSquare size={34}/><h3>A conversation worth starting.</h3><p>{data?.relationship?.type === "direct" ? "Introduce yourself and start a thoughtful conversation." : data?.relationship?.isMentor?"Welcome your mentee and ask how you can help.":"Share your questions, goals and next steps with your mentor."}</p></div>}
    </div>
    <Pager {...{data,page,setPage}}/>
    {!error&&data?.waitingForMentor&&<div className="chat-state-note"><Clock size={17}/>Your mentor will send the first message. You can reply after that.</div>}
    {!error&&data?.relationship?.status==="completed"&&<div className="chat-state-note"><ShieldCheck size={17}/>Messaging is closed. Your conversation history is read only.</div>}
    {!error&&data?.canSend&&<form className="premium-composer" onSubmit={e=>{e.preventDefault();send();}}>
      {attachments.length > 0 && <div className="chat-pending-files">{attachments.map((file,index)=><div className="chat-pending-file" key={`${file.name}-${index}`}>{attachmentPreviews[index] ? <img src={attachmentPreviews[index]} alt="Attachment preview"/> : <FileText size={22}/>}<div><strong>{file.name}</strong><small>{(file.size/1024/1024).toFixed(2)} MB</small></div><button type="button" disabled={sending} aria-label={`Remove ${file.name}`} onClick={()=>setAttachments(files=>files.filter((_,i)=>i!==index))}><X size={15}/></button></div>)}</div>}
      <div className="chat-compose-row"><label className={`chat-attach-button ${sending ? "disabled" : ""}`} title="Attach image or PDF"><Paperclip size={20}/><span className="sr-only">Attach up to 5 images or PDFs, 10 MB each, 25 MB total</span><input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" disabled={sending} onChange={chooseAttachment}/></label>
      <label className="sr-only" htmlFor="chat-message">Your message</label><textarea id="chat-message" value={body} disabled={sending} maxLength={4000} placeholder="Write a message…" onChange={e=>setBody(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send();}}} rows={2}/>
      <button className="primary chat-send-button" type="submit" disabled={sending||(!body.trim()&&!attachments.length)} aria-label="Send message"><Send size={18}/><span>{sending ? attachments.length ? `${uploadProgress}%` : "Sending…" : "Send"}</span></button></div>
      <div className="composer-footer"><small>Up to 5 files · 10 MB each · 25 MB total</small><small>{body.length}/4000</small></div>
    </form>}
    {deleting&&<Modal title="Delete this message?" onClose={()=>setDeleting(null)}><p>The message content will be removed for both people. A deleted-message label will remain in the conversation.</p><div className="actions"><button onClick={()=>setDeleting(null)}>Keep message</button><Action run={async()=>{await api.delete(`/conversations/${id}/messages/${deleting._id}`);setDeleting(null);reload();}}>Delete message</Action></div></Modal>}
  </div>;
}

export { Login, Dashboard, Feed, Mentors, Requests, Messages };
