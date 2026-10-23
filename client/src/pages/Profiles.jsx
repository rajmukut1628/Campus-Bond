import { ConversionPage } from "./Conversions.jsx";
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  Camera,
  Plus,
  Trash2,
  BriefcaseBusiness,
  GraduationCap,
  Globe,
  ArrowUpRight,
  ShieldCheck,
  MapPin,
  MessageCircle,
  Check,
} from "lucide-react";
import {
  api,
  useAuth,
  useLoad,
  Head,
  Avatar,
  Status,
  Notice,
  Loading,
  Empty,
  Form,
  Action,
  Modal,
  errorText,
} from "../components/ui.jsx";
const socialOptions = [
  "LinkedIn",
  "GitHub",
  "Portfolio",
  "Facebook",
  "Instagram",
  "ResearchGate",
  "YouTube",
  "Other",
];
function linkHost(value) {
  try {return new URL(value).hostname;} catch {return value;}
}
function ProfileText({ text }) {
  return <>{String(text || "").split(/(https?:\/\/[^\s<>]+)/g).map((part,i)=>{
    if (!/^https?:\/\//i.test(part)) return <React.Fragment key={i}>{part}</React.Fragment>;
    const url=part.replace(/[.,;!?)]+$/, ""), trailing=part.slice(url.length);
    return <React.Fragment key={i}><a className="profile-inline-link" href={url} target="_blank" rel="noopener noreferrer">{url}</a>{trailing}</React.Fragment>;
  })}</>;
}
function experiencePeriod(job) {
  const month = value => value ? new Date(value).toLocaleDateString("en-GB",{month:"short",year:"numeric"}) : "";
  return [month(job.startDate),job.current ? "Present" : month(job.endDate)].filter(Boolean).join(" - ");
}
function ExperienceTimeline({ items }) {
  if (!items?.length) return null;
  const sorted = [...items].sort((a,b)=>Number(!!b.current)-Number(!!a.current) || (Date.parse(b.startDate)||0)-(Date.parse(a.startDate)||0));
  return <section className="card experience-timeline"><div className="experience-heading"><span className="experience-heading-icon"><BriefcaseBusiness size={21}/></span><div><span className="eyebrow">CAREER JOURNEY</span><h2>Professional experience</h2></div><span className="experience-count">{items.length} {items.length === 1 ? "role" : "roles"}</span></div><div className="experience-roles">{sorted.map((job,i)=><article className={`experience-role ${job.current ? "current" : ""}`} key={job._id || i}><span className="experience-marker" aria-hidden="true"/><div className="experience-role-heading"><h3>{job.position}</h3>{job.current && <span className="experience-current">Current role</span>}</div><strong className="experience-company">{job.company}</strong>{(experiencePeriod(job) || job.location) && <div className="experience-details">{experiencePeriod(job) && <span>{experiencePeriod(job)}</span>}{job.location && <span><MapPin size={13}/>{job.location}</span>}</div>}{job.description && <p className="preserve"><ProfileText text={job.description}/></p>}</article>)}</div></section>;
}
export function ProfileSummary({ user }) {
  const administrator = ["admin", "superadmin"].includes(user.role);
  return (
    <div className={`public-profile role-${user.role}`}>
      <section
        className={
          "profile-identity-card " +
          (user.role === "alumni" ? "premium-alumni" : "")
        }
      >
        <div className="profile-cover">
          <div className="profile-orbit-art" aria-hidden="true"><i/><i/><i/><span/></div>
          <span>
            <GraduationCap size={20} /> CampusBond
          </span>
          <Status value={user.role} />
        </div>
        <div className="profile-identity-body">
          <Avatar user={user} large />
          <div className="profile-title">
            <span className="profile-role-label">{{student:"STUDENT PROFILE",alumni:"ALUMNI PROFILE",admin:"ADMINISTRATOR PROFILE",superadmin:"SUPER ADMIN PROFILE"}[user.role]}</span>
            <h1>{user.name}</h1>
            <p>{(administrator ? user.position : user.role === "alumni" ? [user.position,user.company].filter(Boolean).join(" at ") : "Student") || (user.role === "alumni" ? "Alumni" : user.role === "superadmin" ? "Super Admin" : "Administrator")}</p>
            <div className="profile-meta">
              {!administrator && user.department && (
                <span>
                  <GraduationCap size={14} />
                  {user.department}
                </span>
              )}
              {!administrator && user.batch && <span>Batch {user.batch}</span>}
              {!administrator && user.graduationYear && (
                <span>Class of {user.graduationYear}</span>
              )}
            </div>
          </div>

        </div>
      </section>
      {user.role === "alumni" && <ContactSummary user={user}/>}
      {administrator ? (
        <section className="card profile-about-card">
          <h2><ShieldCheck size={19} /> Administration profile</h2>
          <p className="preserve"><ProfileText text={user.bio || "University community administration and support."}/></p>
        </section>
      ) : (
      <div className={`profile-public-grid ${!user.qualifications?.length && !user.linkedin && !user.socialLinks?.length ? "profile-public-single" : ""}`}>
        <div>
          {(user.bio || user.skills?.length > 0) && <section className="card profile-about-card">
            <span className="eyebrow">THE PERSON BEHIND THE PROFILE</span>
            <h2>{user.role === "alumni" ? "Professional introduction" : "About " + user.name.split(" ")[0]}</h2>
            <p className="preserve">
              <ProfileText text={user.bio || "This member has not added an introduction yet."}/>
            </p>
            {user.skills?.length > 0 && (
              <>
                <h3>Expertise & interests</h3>
                <div className="tags profile-skill-tags">
                  {user.skills.map((skill, i) => (
                    <span key={i}>{skill}</span>
                  ))}
                </div>
              </>
            )}
          </section>}
          {user.role === "alumni" && <ExperienceTimeline items={user.workExperience}/>}

        </div>
        <aside>
          {user.qualifications?.length > 0 && <section className="card profile-qualifications-card">
            <h2>
              <GraduationCap size={19} /> Qualifications
            </h2>
            {user.qualifications?.length ? (
              user.qualifications.map((q, i) => (
                <article className="qualification-entry" key={q._id || i}>
                  <strong>{q.title}</strong>
                  <small>
                    {q.institution}
                    {q.year && " · " + q.year}
                  </small>
                </article>
              ))
            ) : (
              <p>No qualifications added yet.</p>
            )}
          </section>}
          {(user.linkedin || user.socialLinks?.length > 0) && <section className="card profile-public-links">
            <h2>
              <Globe size={19} /> Professional and social links
            </h2>
            {user.linkedin && (
              <a
                className="social-link"
                href={user.linkedin}
                target="_blank"
                rel="noopener noreferrer"
              >
                Professional profile <ArrowUpRight size={15} />
              </a>
            )}
            {user.socialLinks?.map((link, i) => (
              <a
                className="social-link"
                href={link.url}
                key={link._id || i}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span><strong>{link.label}</strong><small>{linkHost(link.url)}</small></span>
                <ArrowUpRight size={15} />
              </a>
            ))}
            {!user.linkedin && !user.socialLinks?.length && (
              <p>No social links added yet.</p>
            )}
          </section>}
        </aside>
      </div>
      )}
    </div>
  );
}
function ContactSummary({ user }) {
  const open = user.contactPreference === "open";
  return <section className={`profile-contact-summary ${open ? "is-open" : ""}`}>
    <div className="profile-contact-icon"><MessageCircle size={22}/></div><div><span className="eyebrow">CONTACT PREFERENCE</span><h2>{open ? "Open messaging" : "Mentorship request first"}</h2><p>{open ? "Students and Alumni can start a direct conversation." : user.mentoring ? "Send a mentorship request before starting a conversation." : "Not accepting new mentorship requests right now."}</p><span className="profile-mentoring-state">{user.mentoring ? "Available for new mentorships" : "New mentorship requests paused"}</span></div>
  </section>;
}
function ContactPreferences({ onSaved }) {
  const {user,setUser}=useAuth();
  const [preference,setPreference]=useState(user.contactPreference || "request-first"), [mentoring,setMentoring]=useState(!!user.mentoring);
  return <div className="profile-contact-editor"><p>This preference is visible on your community profile.</p><div className="contact-choice-list" role="group" aria-label="Contact preference">
    {[["open","Open messaging","Students and Alumni can message directly."],["request-first","Mentorship request first","Approve a mentorship request before messaging. Your first message opens the conversation."]].map(([value,title,description])=><button type="button" key={value} className={`contact-choice ${preference === value ? "selected" : ""}`} aria-pressed={preference === value} onClick={()=>setPreference(value)}><span className="contact-choice-icon">{preference === value ? <Check size={18}/> : <MessageCircle size={18}/>}</span><span><strong>{title}</strong><small>{description}</small></span></button>)}
    </div><label className="checkbox"><input type="checkbox" checked={mentoring} onChange={e=>setMentoring(e.target.checked)}/>Available for new mentorship requests</label><Action className="primary" run={async()=>{const response=await api.patch("/users/me",{contactPreference:preference,mentoring});setUser(response.data.user);onSaved();}}>Save preference</Action>
  </div>;
}
function PhotoUploader({ onSaved }) {
  const {user,setUser}=useAuth(), input=useRef(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  return <div className="direct-photo-picker"><input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={async e=>{
    const file=e.target.files?.[0]; e.target.value="";
    if (!file) return;
    setError("");
    if(file.size > 5*1024*1024) {setError("Choose an image no larger than 5 MB.");return;}
    setBusy(true);
    try {const data=new FormData();data.append("image",file);const response=await api.post("/users/me/avatar",data);setUser(response.data.user);onSaved?.("Profile picture updated.");}
    catch(e) {setError(errorText(e));} finally {setBusy(false);}
  }}/><div className="row wrap"><button type="button" disabled={busy} onClick={()=>input.current?.click()}><Camera size={16}/>{busy ? "Uploading picture..." : "Change picture"}</button>{user.avatar && !busy && <Action title="Remove profile picture" aria-label="Remove profile picture" run={async()=>{if(busy)return;const response=await api.delete("/users/me/avatar");setUser(response.data.user);onSaved?.("Profile picture removed.");}}><Trash2 size={15}/></Action>}</div><Notice error={error}/></div>;
}
function CollectionEditor({ title, kind, items, onChange }) {
  const [editing, setEditing] = useState(null),
    [show, setShow] = useState(false),
    [isCurrent, setIsCurrent] = useState(false);
  const definitions = {
    workExperience: [
      { name: "position", label: "Job title" },
      { name: "company" },
      { name: "location", optional: true },
      { name: "startDate", label: "Start date", type: "date", optional: true },
      { name: "endDate", label: "End date", type: "date", optional: true },
      {
        name: "current",
        label: "I currently work here",
        options: ["false", "true"],
      },
      { name: "description", area: true, max: 2000, optional: true },
    ],
    qualifications: [
      { name: "title", label: "Degree, qualification or certification" },
      { name: "institution" },
      { name: "year", type: "number", min: 1950, max: 2100, optional: true },
    ],
    socialLinks: [
      { name: "label", label: "Platform", options: socialOptions },
      { name: "url", label: "HTTPS URL", type: "url" },
    ],
  };
  return (
    <section className={`card collection-editor ${kind === "workExperience" ? "experience-manager" : ""}`}>
      <div className="row between">
        <h2>{title}{kind === "workExperience" && items.length > 0 && <span className="experience-count">{items.length} / 20</span>}</h2>
        <button
          disabled={items.length >= (kind === "socialLinks" ? 10 : 20)}
          onClick={() => {
            setEditing(null);
            setIsCurrent(false);
            setShow(true);
          }}
        >
          <Plus size={16} />
          Add{" "}
          {kind === "workExperience"
            ? "experience"
            : kind === "socialLinks"
              ? "link"
              : "qualification"}
        </button>
      </div>
      {kind === "workExperience" && <p className="experience-manager-note">Add each job or role separately, including roles you hold at the same time. Saved entries appear on your community profile.</p>}
      {items.length ? (
        items.map((item, i) => (
          <div className="editable-entry" key={i}>
            <div>
              <strong>{item.position || item.title || item.label}</strong>
              <small>{item.company || item.institution || item.url}</small>
              {kind === "workExperience" && <div className="experience-details">{experiencePeriod(item) && <span>{experiencePeriod(item)}</span>}{item.current && <span className="experience-current">Current role</span>}</div>}
            </div>
            <div className="row">
              <button
                onClick={() => {
                  setEditing(i);
                  setIsCurrent(!!item.current);
                  setShow(true);
                }}
              >
                Edit
              </button>
              <Action
                className="danger-button"
                aria-label={
                  "Remove " + (item.position || item.title || item.label)
                }
                run={() => onChange(items.filter((_, index) => index !== i))}
              >
                <Trash2 size={15} />
              </Action>
            </div>
          </div>
        ))
      ) : (
        <p>No entries yet. Add details when you are ready.</p>
      )}
      {show && (
        <Modal
          title={
            (editing === null ? "Add" : "Edit") + " " + title.toLowerCase()
          }
          onClose={() => setShow(false)}
        >
          {kind === "workExperience" && <label className="checkbox experience-current-toggle"><input type="checkbox" checked={isCurrent} onChange={e=>setIsCurrent(e.target.checked)}/>I currently work here</label>}
          <Form
            fields={definitions[kind].filter(field => kind !== "workExperience" || (field.name !== "current" && !(isCurrent && field.name === "endDate")))}
            initial={
              editing === null
                ? {}
                : {
                    ...items[editing],
                    current: String(items[editing].current || false),
                    startDate: items[editing].startDate?.slice(0, 10) || "",
                    endDate: items[editing].endDate?.slice(0, 10) || "",
                  }
            }
            submit="Save entry"
            onSubmit={async (values) => {
              if (kind === "workExperience") {
                values.current = isCurrent;
                if (!values.startDate) delete values.startDate;
                if (values.current || !values.endDate) delete values.endDate;
                if (
                  values.startDate &&
                  values.endDate &&
                  new Date(values.startDate) > new Date(values.endDate)
                )
                  throw new Error("End date must be after start date");
              }
              if (kind === "qualifications" && !values.year) delete values.year;
              const next = [...items];
              if (editing === null) next.push(values);
              else next[editing] = values;
              await onChange(next);
              setShow(false);
            }}
          />
          <button type="button" onClick={()=>setShow(false)}>Cancel</button>
        </Modal>
      )}
    </section>
  );
}
export function Profile() {
  const { user, setUser } = useAuth();
  const [panel, setPanel] = useState(null), [saved, setSaved] = useState("");
  const [params,setParams]=useSearchParams();
  useEffect(()=>{if(params.get("conversion") === "true" && ["student","alumni"].includes(user.role)) setPanel("conversion");},[params,user.role]);
  const closeConversion=()=>{setPanel(null);const next=new URLSearchParams(params);next.delete("conversion");setParams(next,{replace:true});};
  const administrator = ["admin", "superadmin"].includes(user.role);
  const fields = [
    { name:"name", label:"Full name", max:100 },
    { name:"bio", label:administrator ? "Role and responsibilities" : user.role === "alumni" ? "Professional introduction" : "About you and your study interests", area:true, max:2000, optional:true },
    ...(!administrator ? [{name:"skills",label:user.role === "alumni" ? "Professional skills (comma separated)" : "Skills and learning interests (comma separated)",optional:true}] : []),
    ...(user.role === "alumni" ? [{name:"position",label:"Current job title",max:120,optional:true},{name:"company",label:"Current organization",max:120,optional:true}] : administrator ? [{name:"position",label:"Administrative designation",max:120,optional:true}] : []),
  ];
  const saveCollection = kind => async items => {
    const response = await api.patch("/users/me", {[kind]:items});
    setUser(response.data.user); setSaved("Profile updated successfully.");
  };
  return <>
    <Head title={administrator ? (user.role === "superadmin" ? "Super Admin profile" : "Administrator profile") : user.role === "alumni" ? "Your Alumni profile" : "Your Student profile"} description="Your information, profile and account security.">
      <Link className="button" to={"/app/members/"+user._id}>View profile <ArrowUpRight size={15}/></Link>
    </Head>
    {saved && <div className="success" role="status">{saved}</div>}
    <div className="profile-editor-grid profile-settings-summary"><div>
      <section className="card"><div className="row between"><div className="row"><Avatar user={user} large/><div><h2>{user.name}</h2><p>{administrator ? user.position || (user.role === "superadmin" ? "Super Admin" : "Administrator") : (user.role === "alumni" ? [user.position,user.company].filter(Boolean).join(" at ") || "Alumni" : "Student")}</p></div></div><PhotoUploader onSaved={setSaved}/></div></section>
      <section className="card official-record"><div className="row between"><h2>{administrator ? "Administrative information" : "Personal information"}</h2><button type="button" onClick={()=>setPanel("information")}>Edit information</button></div>
        <dl><div><dt>Name</dt><dd>{user.name}</dd></div><div><dt>{administrator ? "Administrative introduction" : "About you"}</dt><dd className="preserve">{user.bio || "Not added"}</dd></div>
        {!administrator && <div><dt>Skills and interests</dt><dd>{user.skills?.join(", ") || "Not added"}</dd></div>}
        {administrator && <div><dt>Designation</dt><dd>{user.position || "Not added"}</dd></div>}
        {user.role === "alumni" && <><div><dt>Current position</dt><dd>{[user.position,user.company].filter(Boolean).join(" at ") || "Not added"}</dd></div><div><dt>Mentorship availability</dt><dd>{user.mentoring ? "Available" : "Unavailable"}</dd></div></>}
        </dl>
      </section>
      {user.role === "alumni" && <section className="card profile-contact-settings"><ContactSummary user={user}/><button type="button" onClick={()=>setPanel("contact")}>Manage contact preference</button></section>}
      {user.role === "alumni" && <CollectionEditor title="Professional experience" kind="workExperience" items={user.workExperience || []} onChange={saveCollection("workExperience")}/>}
      {!administrator && <><CollectionEditor title="Qualifications" kind="qualifications" items={user.qualifications || []} onChange={saveCollection("qualifications")}/><CollectionEditor title="Social links" kind="socialLinks" items={user.socialLinks || []} onChange={saveCollection("socialLinks")}/></>}
    </div><aside>
      <section className="card official-record"><h2><ShieldCheck size={19}/>{administrator ? "Administrator account" : "University account"}</h2><dl><div><dt>Email</dt><dd>{user.email}</dd></div>
      {administrator ? <div><dt>Access role</dt><dd>{user.role === "superadmin" ? "Super Admin" : "Administrator"}</dd></div> : <><div><dt>University ID</dt><dd>{user.universityId}</dd></div><div><dt>Department</dt><dd>{user.department || "Not assigned"}</dd></div><div><dt>Batch</dt><dd>{user.batch || "Not assigned"}</dd></div></>}
      </dl><p>{administrator ? "Access permissions follow your administrator role." : "University identity is managed by your Administrator."}</p>
      {!administrator && <button type="button" className="profile-conversion-trigger" onClick={()=>setPanel("conversion")}><GraduationCap size={16}/>Alumni conversion<ArrowUpRight size={14}/></button>}
      </section>
      <section className="card"><h2>Account security</h2><p>Update your password securely. Other sessions will be signed out.</p><button type="button" onClick={()=>setPanel("password")}>Change password</button></section>
    </aside></div>

    {panel === "conversion" && !administrator && <Modal title="Alumni conversion" onClose={closeConversion}><ConversionPage/></Modal>}
    {panel === "information" && <Modal title={administrator ? "Edit administrative information" : "Edit personal information"} onClose={()=>setPanel(null)}><p className="profile-visibility-note"><Globe size={15}/>These details appear on your profile for signed-in community members.</p><Form fields={fields} initial={{...user,skills:user.skills?.join(", "),mentoring:String(user.mentoring),contactPreference:user.contactPreference || "request-first"}} submit="Save changes" onSubmit={async values=>{
      if (!administrator) values.skills=(values.skills || "").split(",").map(v=>v.trim()).filter(Boolean);
      const response=await api.patch("/users/me",values);setUser(response.data.user);setPanel(null);setSaved("Information updated successfully.");
    }}/><button type="button" onClick={()=>setPanel(null)}>Cancel</button></Modal>}
    {panel === "contact" && user.role === "alumni" && <Modal title="Mentorship and contact preference" onClose={()=>setPanel(null)}><ContactPreferences onSaved={()=>{setPanel(null);setSaved("Contact preference updated.");}}/></Modal>}
    {panel === "password" && <Modal title="Change password" onClose={()=>setPanel(null)}><Form fields={[{name:"currentPassword",label:"Current password",type:"password"},{name:"password",label:"New password (minimum 8 characters)",type:"password",minLength:8}]} submit="Update password" onSubmit={async values=>{await api.put("/auth/password",values);setPanel(null);setSaved("Password changed successfully.");}}/><button type="button" onClick={()=>setPanel(null)}>Cancel</button></Modal>}
  </>;
}
export function MemberProfile() {
  const navigate = useNavigate();
  const { id } = useParams(),
    { data, error, loading, reload } = useLoad("/users/" + id),
    { user } = useAuth(),
    [request, setRequest] = useState(false),
    [sent, setSent] = useState(false),
    [submittedRelation, setSubmittedRelation] = useState(null);
  useEffect(() => { setSubmittedRelation(null); setSent(false); setRequest(false); }, [id]);
  useEffect(() => { const timer = setInterval(reload, 15000); return () => clearInterval(timer); }, [id]);
  useEffect(() => { if (data?.mentorship) setSubmittedRelation(null); }, [data]);
  const relationship = submittedRelation || data?.mentorship;
  const canConnect = ["student","alumni"].includes(user.role) && data?.user?.role === "alumni" && user._id !== data.user._id;
  const directAvailable = canConnect && (data?.directMessaging?.canStart || data?.directMessaging?.conversationId) && !data?.directMessaging?.blocked;
  let profileAction = null;
  if (canConnect) {
    if (relationship?.status === "accepted") profileAction = <Link className="button primary profile-connect-button" to={"/app/messages/"+relationship._id}><MessageCircle size={17}/>Message mentor<ArrowUpRight size={15}/></Link>;
    else if (relationship?.status === "completed") profileAction = relationship.closedForConversion ? <span className="profile-connection-state">Mentorship completed</span> : <Link className="button profile-connect-button" to={"/app/messages/"+relationship._id}><MessageCircle size={17}/>View conversation<ArrowUpRight size={15}/></Link>;
    else if (directAvailable) profileAction = <Action className="primary profile-connect-button" run={async()=>{const response=await api.post("/direct-conversations",{recipient:data.user._id});navigate(`/app/messages/${response.data.item._id}`);}}><MessageCircle size={17}/>{data.user.contactPreference === "open" ? "Message  -  Open messaging" : "Open conversation"}<ArrowUpRight size={15}/></Action>;
    else if (relationship?.status === "pending") profileAction = <button type="button" className="profile-connection-state" disabled><Check size={16}/>Request pending</button>;
    else if (!relationship && data.user.mentoring && data.user.contactPreference !== "open") profileAction = <button type="button" className="primary profile-connect-button" onClick={()=>setRequest(true)}><GraduationCap size={18}/>Request mentorship<ArrowUpRight size={15}/></button>;
    else if (relationship?.status === "rejected") profileAction = <span className="profile-connection-state">Request declined</span>;
  }

  if (loading && !data) return <Loading />;
  return (
    <>
      <Notice error={error} />
      {data?.user && (
        <>
          <div className="public-profile-page-heading"><span className="eyebrow">YOUR UNIVERSITY NETWORK</span><div className="profile-top-action">{profileAction}</div></div>
          <ProfileSummary user={data.user} />
          {sent && (
            <div className="success">
              Your mentorship request has been sent.
            </div>
          )}
          {request && (
            <Modal
              title={"Request mentorship from " + data.user.name}
              onClose={() => setRequest(false)}
            >
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
                submit="Send mentorship request"
                onSubmit={async (values) => {
                  const response = await api.post("/mentorships", {
                    ...values,
                    mentor: data.user._id,
                  });
                  setSubmittedRelation(response.data.item);
                  reload();
                  setRequest(false);
                  setSent(true);
                }}
              />
            </Modal>
          )}
        </>
      )}
    </>
  );
}
