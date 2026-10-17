import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
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
  Phone,
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
export function ProfileSummary({ user }) {
  const administrator = ["admin", "superadmin"].includes(user.role);
  return (
    <>
      <section
        className={
          "profile-identity-card " +
          (user.role === "alumni" ? "premium-alumni" : "")
        }
      >
        <div className="profile-cover">
          <span>
            <GraduationCap size={20} /> NUB CONNECT
          </span>
          <Status value={user.role} />
        </div>
        <div className="profile-identity-body">
          <Avatar user={user} large />
          <div className="profile-title">
            <h1>{user.name}</h1>
            <p>
              {(!administrator && user.headline) ||
                (administrator ? user.position : [user.position, user.company].filter(Boolean).join(" at ")) ||
                {
                  student: "Building the next chapter",
                  alumni: "Alumni · Experience worth sharing",
                  admin: "University administration",
                  superadmin: "University leadership",
                }[user.role]}
            </p>
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
          {user.role === "alumni" && (
            <span className="mentor-availability">
              {user.mentoring
                ? "Open to mentorship"
                : "Professional community member"}
            </span>
          )}
        </div>
      </section>
      {administrator ? (
        <section className="card">
          <h2><ShieldCheck size={19} /> Administration profile</h2>
          <p className="preserve">{user.bio || "University community administration and support."}</p>
        </section>
      ) : (
      <div className="profile-public-grid">
        <div>
          <section className="card">
            <h2>About {user.name.split(" ")[0]}</h2>
            <p className="preserve">
              {user.bio || "This member has not added an introduction yet."}
            </p>
            {user.skills?.length > 0 && (
              <>
                <h3>Expertise & interests</h3>
                <div className="tags">
                  {user.skills.map((skill, i) => (
                    <span key={i}>{skill}</span>
                  ))}
                </div>
              </>
            )}
          </section>
          {user.role === "alumni" && (
            <section className="card">
              <h2>
                <BriefcaseBusiness size={19} /> Professional experience
              </h2>
              {user.workExperience?.length ? (
                user.workExperience.map((job, i) => (
                  <article className="career-entry" key={job._id || i}>
                    <span className="career-dot" />
                    <div>
                      <h3>{job.position}</h3>
                      <strong>{job.company}</strong>
                      <small>
                        {[
                          job.location,
                          job.startDate &&
                            new Date(job.startDate).getFullYear(),
                          job.current
                            ? "Present"
                            : job.endDate &&
                              new Date(job.endDate).getFullYear(),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                      {job.description && (
                        <p className="preserve">{job.description}</p>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <p>
                  {user.experience ||
                    "Professional experience has not been added yet."}
                </p>
              )}
            </section>
          )}
        </div>
        <aside>
          <section className="card">
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
          </section>
          <section className="card">
            <h2>
              <Globe size={19} /> Around the web
            </h2>
            {user.linkedin && (
              <a
                className="social-link"
                href={user.linkedin}
                target="_blank"
                rel="noreferrer"
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
                rel="noreferrer"
              >
                {link.label}
                <ArrowUpRight size={15} />
              </a>
            ))}
            {!user.linkedin && !user.socialLinks?.length && (
              <p>No social links added yet.</p>
            )}
          </section>
        </aside>
      </div>
      )}
    </>
  );
}
function PhotoUploader() {
  const { user, setUser } = useAuth(),
    [file, setFile] = useState(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <section className="card picture-editor">
      <div>
        <h2>
          <Camera size={19} /> Profile picture
        </h2>
        <p>
          PNG, JPG/JPEG, WebP, GIF or AVIF · maximum 5 MB. Animated images
          become a still photo.
        </p>
      </div>
      <div className="picture-upload-row">
        <span className="picture-preview">
          {preview ? (
            <img src={preview} alt="Selected profile picture preview" />
          ) : (
            <Avatar user={user} large />
          )}
        </span>
        <div className="picture-upload-controls">
          <label className="button photo-file-label">
            Choose picture
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              disabled={busy}
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                setError("");
                setDone("");
                if (chosen && chosen.size > 5 * 1024 * 1024) {
                  setFile(null);
                  setError("Choose an image smaller than 5 MB");
                  e.target.value = "";
                  return;
                }
                setFile(chosen || null);
              }}
            />
          </label>
          <button
            className="primary"
            disabled={!file || busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const data = new FormData();
                data.append("image", file);
                const response = await api.post("/users/me/avatar", data);
                setUser(response.data.user);
                setFile(null);
                setDone("Profile picture updated.");
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Uploading…" : "Upload picture"}
          </button>
          {user.avatar && (
            <Action
              run={async () => {
                const response = await api.delete("/users/me/avatar");
                setUser(response.data.user);
                setFile(null);
                setDone("Profile picture removed.");
              }}
            >
              Remove picture
            </Action>
          )}
        </div>
      </div>
      <Notice error={error} />
      {done && (
        <div className="success" role="status">
          {done}
        </div>
      )}
    </section>
  );
}
function CollectionEditor({ title, kind, items, onChange }) {
  const [editing, setEditing] = useState(null),
    [show, setShow] = useState(false);
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
    <section className="card collection-editor">
      <div className="row between">
        <h2>{title}</h2>
        <button
          disabled={items.length >= (kind === "socialLinks" ? 10 : 20)}
          onClick={() => {
            setEditing(null);
            setShow(true);
          }}
        >
          <Plus size={16} />
          Add{" "}
          {kind === "workExperience"
            ? "job"
            : kind === "socialLinks"
              ? "link"
              : "qualification"}
        </button>
      </div>
      {items.length ? (
        items.map((item, i) => (
          <div className="editable-entry" key={i}>
            <div>
              <strong>{item.position || item.title || item.label}</strong>
              <small>{item.company || item.institution || item.url}</small>
            </div>
            <div className="row">
              <button
                onClick={() => {
                  setEditing(i);
                  setShow(true);
                }}
              >
                Edit
              </button>
              <button
                className="danger-button"
                aria-label={
                  "Remove " + (item.position || item.title || item.label)
                }
                onClick={() =>
                  onChange(items.filter((_, index) => index !== i))
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))
      ) : (
        <p>No entries yet. Add details and save your profile below.</p>
      )}
      {show && (
        <Modal
          title={
            (editing === null ? "Add" : "Edit") + " " + title.toLowerCase()
          }
          onClose={() => setShow(false)}
        >
          <Form
            fields={definitions[kind]}
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
            submit="Keep entry"
            onSubmit={async (values) => {
              if (kind === "workExperience") {
                values.current = values.current === "true";
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
              onChange(next);
              setShow(false);
            }}
          />
        </Modal>
      )}
    </section>
  );
}
export function Profile() {
  const { user, setUser } = useAuth(),
    [tab, setTab] = useState("edit"),
    [saved, setSaved] = useState(""),
    [work, setWork] = useState(user.workExperience || []),
    [qualifications, setQualifications] = useState(user.qualifications || []),
    [socials, setSocials] = useState(user.socialLinks || []);
  const administrator = ["admin", "superadmin"].includes(user.role);
  const fields = [
    { name: "name" },
    ...(!administrator ? [{ name: "headline", label: "Profile headline", optional: true }] : []),
    { name: "bio", label: administrator ? "Administrative introduction" : "About you", area: true, max: 2000, optional: true },
    {
      name: "phone",
      label: "Private contact number",
      type: "tel",
      optional: true,
    },
    ...(!administrator ? [{ name: "skills", label: "Skills and interests (comma separated)", optional: true }] : []),
    ...(user.role === "alumni"
      ? [
          { name: "position", label: "Current job title", optional: true },
          { name: "company", label: "Current company", optional: true },
          {
            name: "mentoring",
            label: "Available for new mentorships",
            options: ["true", "false"],
          },
        ]
      : ["admin", "superadmin"].includes(user.role)
        ? [
            {
              name: "position",
              label: "Administrative designation",
              optional: true,
            },
          ]
        : []),
  ];
  return (
    <>
      <Head
        title={
          administrator ? "Administrator profile" : user.role === "alumni"
            ? "Your experience. Your next impact."
            : "Your profile, your next chapter."
        }
        description={administrator ? "Manage your administrative identity, contact details and account security." : "Build a profile that helps the right people connect with you."}
      >
        <Link className="button" to={"/app/members/" + user._id}>
          {administrator ? "View administrator profile" : "View member profile"} <ArrowUpRight size={15} />
        </Link>
      </Head>
      <div className="profile-editor-grid">
        <div>
          <PhotoUploader />
          <section className="card official-record">
            <h2>
              <ShieldCheck size={19} /> {administrator ? "Administrator account" : "University account"}
            </h2>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              {!administrator && <div>
                <dt>University ID</dt>
                <dd>{user.universityId}</dd>
              </div>}
              {!administrator && <><div>
                <dt>Department</dt>
                <dd>{user.department || "Not assigned"}</dd>
              </div>
              <div>
                <dt>Batch</dt>
                <dd>{user.batch || "Not assigned"}</dd>
              </div></>}
              {administrator && <div><dt>Access role</dt><dd>{user.role === "superadmin" ? "Super Admin" : "Administrator"}</dd></div>}
            </dl>
            <p>{administrator ? "Your access permissions are determined by your administrator role." : "University identity is managed by your Administrator."}</p>
            {user.role === "student" && (
              <Link className="button" to="/app/conversion">
                Graduated? Request Alumni conversion <ArrowUpRight size={15} />
              </Link>
            )}
          </section>
          {user.role === "alumni" && (
            <>
              <CollectionEditor
                title="Professional experience"
                kind="workExperience"
                items={work}
                onChange={setWork}
              />
              <Link className="button profile-job-link" to="/app/jobs">
                Manage your job opportunities <BriefcaseBusiness size={16} />
              </Link>
            </>
          )}
          {!administrator && <>
          <CollectionEditor
            title="Qualifications"
            kind="qualifications"
            items={qualifications}
            onChange={setQualifications}
          />
          <CollectionEditor
            title="Social links"
            kind="socialLinks"
            items={socials}
            onChange={setSocials}
          />
          </>}
          <section className="card">
            <h2>{administrator ? "Administrative details" : "Edit introduction"}</h2>
            <p>
              {administrator ? "Update your name, designation, introduction and private contact number." : "Save your profile to apply all introduction, experience, qualification and social-link changes."}
            </p>
            {saved && (
              <div className="success" role="status">
                {saved}
              </div>
            )}
            <Form
              fields={fields}
              initial={{
                ...user,
                skills: user.skills?.join(", "),
                mentoring: String(user.mentoring),
              }}
              submit="Save profile"
              onSubmit={async (values) => {
                if (!administrator) {
                  values.skills = (values.skills || "").split(",").map((v) => v.trim()).filter(Boolean);
                  values.qualifications = qualifications;
                  values.socialLinks = socials;
                }
                if (user.role === "alumni") {
                  values.workExperience = work;
                  values.mentoring = values.mentoring === "true";
                }
                const response = await api.patch("/users/me", values);
                setUser(response.data.user);
                setSaved("Profile saved successfully.");
              }}
            />
          </section>
        </div>
        <aside>
          <section className="card">
            <h2>Account security</h2>
            <p>Changing your password revokes other sessions.</p>
            <Form
              fields={[
                {
                  name: "currentPassword",
                  label: "Current password",
                  type: "password",
                },
                {
                  name: "password",
                  label: "New password (minimum 11 characters)",
                  type: "password",
                  minLength: 11,
                },
              ]}
              submit="Change password"
              onSubmit={async (values) => {
                await api.put("/auth/password", values);
                setSaved("Password changed successfully.");
              }}
            />
          </section>
          <section className="note-card">
            <span className="eyebrow">{administrator ? "ADMINISTRATION" : "MAKE YOUR PROFILE COUNT"}</span>
            <h3>
              {administrator ? "A clear identity for community support." : user.role === "alumni"
                ? "Your experience could open someone’s next door."
                : "A clearer profile creates better connections."}
            </h3>
            <p>
              {administrator ? "Keep your name, designation and picture current so members can recognize your administrative role. Your contact number remains private." : "Use a clear picture, a useful introduction and current qualifications. Only active members can view community profiles."}
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
export function MemberProfile() {
  const { id } = useParams(),
    { data, error, loading, reload } = useLoad("/users/" + id),
    { user } = useAuth(),
    [request, setRequest] = useState(false),
    [sent, setSent] = useState(false),
    [submittedRelation, setSubmittedRelation] = useState(null);
  useEffect(() => { setSubmittedRelation(null); setSent(false); }, [id]);
  useEffect(() => { const timer = setInterval(reload, 15000); return () => clearInterval(timer); }, [id]);
  useEffect(() => { if (data?.mentorship) setSubmittedRelation(null); }, [data]);
  const relationship = submittedRelation || data?.mentorship;
  if (loading && !data) return <Loading />;
  return (
    <>
      <Notice error={error} />
      {data?.user && (
        <>
          <Head
            title="Community profile"
            description="The person, the journey, the possibilities."
          />
          <ProfileSummary user={data.user} />
          {sent && (
            <div className="success">
              Your mentorship request has been sent.
            </div>
          )}
          {["student", "alumni"].includes(user.role) && user._id !== data.user._id &&
            data.user.role === "alumni" &&
            data.user.mentoring && !relationship && (
              <div className="profile-bottom-cta">
                <button className="primary" onClick={() => setRequest(true)}>
                  Request mentorship <ArrowUpRight size={16} />
                </button>
              </div>
            )}
          {["student", "alumni"].includes(user.role) && relationship && <div className="profile-bottom-cta">
            <p>{{pending:"Request pending",accepted:"Mentorship accepted",rejected:"Request declined",completed:"Mentorship completed"}[relationship.status]}</p>
            {relationship.status === "accepted" && <Link className="button primary" to={"/app/messages/" + relationship._id}>Message mentor</Link>}
            {relationship.status === "completed" && !relationship.closedForConversion && <Link className="button" to={"/app/messages/" + relationship._id}>View conversation history</Link>}
          </div>}
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
