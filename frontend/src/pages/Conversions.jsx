import { ChatAttachments } from "../components/ChatAttachment.jsx";
import { useParams } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { GraduationCap, CheckCircle2 } from "lucide-react";
import {
  api,
  useAuth,
  useLoad,
  Head,
  Notice,
  Loading,
  Empty,
  Form,
  Pager,
  Status,
  Modal,
  Avatar,
  date,
} from "../components/ui.jsx";
export function ConversionPage() {
  const {user}=useAuth(), [page,setPage]=useState(1), [done,setDone]=useState("");
  const {data,error,loading,reload}=useLoad("/conversions?page="+page);
  return <div className="conversion-popup">
    <div className="conversion-popup-intro"><span className="conversion-popup-icon"><GraduationCap size={26}/></span><div><span className="eyebrow">YOUR NEXT CHAPTER</span><h3>{user.role === "alumni" ? "Your Alumni account" : "Ready to become an Alumni?"}</h3><p>{user.role === "alumni" ? "Your account already has Alumni access." : "Submit your completed degree details for administrator review."}</p></div></div>
    <Notice error={error}/>{done && <div className="success" role="status">{done}</div>}
    {loading ? <Loading/> : user.role === "alumni" ? <div className="conversion-current-status"><CheckCircle2 size={18}/><strong>Alumni account</strong></div> : data?.pending ? <div className="conversion-current-status"><Status value="pending"/><p>Your request is awaiting review. You can keep using your Student account.</p></div> : <>
      <p className="conversion-essential-note">Approval keeps your account and posts. Existing Student mentorships close and remain in your conversation archive.</p>
      <Form fields={[{name:"degree",label:"Completed degree",max:200},{name:"graduationYear",label:"Graduation year",type:"number",min:1950,max:new Date().getFullYear()},{name:"reason",label:"Graduation details for review",area:true,minLength:10,max:2000}]} submit="Send conversion request" onSubmit={async values=>{await api.post("/conversions",values);setDone("Request sent for review.");setPage(1);reload();}}/>
    </>}
    {!!data?.items.length && <details className="conversion-request-history"><summary>Request history <span>{data.total ?? data.items.length}</span></summary>{data.items.map(item=><article key={item._id} className="conversion-history-item"><div className="row between"><strong>{item.degree} / {item.graduationYear}</strong><Status value={item.status}/></div><small>Requested {date(item.createdAt)}</small>{item.reviewedAt && <small>{item.status === "accepted" ? "Approved" : "Reviewed"} by {item.reviewedBy?.name || "Reviewer unavailable"} / {date(item.reviewedAt)}</small>}{item.reviewNote && <p>{item.reviewNote}</p>}</article>)}<Pager {...{data,page,setPage}} numbered/></details>}
  </div>;
}
export function ConversionReview() {
  const [status, setStatus] = useState("pending"),
    [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [review, setReview] = useState(null),
    [done, setDone] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, loading, reload } = useLoad(
    "/admin/conversions?" +
      new URLSearchParams({ status, q: search, page: String(page) }),
  );
  return (
    <>
      <Head
        title="Alumni conversion requests"
        description="Review graduation details and help students move to their Alumni chapter."
      />
      <div className="card conversion-filters">
        <label>
          Request status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {["pending", "accepted", "rejected", "all"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search student
          <input
            type="search"
            value={q}
            maxLength={100}
            placeholder="Name, Email"
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      <Notice error={error} />
      {done && (
        <div className="success" role="status">
          {done}
        </div>
      )}
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        data.items.map((item) => (
          <article className="card conversion-request" key={item._id}>
            <div className="row between">
              <div className="row">
                <Avatar user={item.student} />
                <div>
                  <h2>{item.student?.name || "Former member"}</h2>
                  <small>
                    {item.student?.email} · {item.student?.universityId}
                  </small>
                  <small>
                    {item.department || item.student?.department}{" "}
                    {item.batch && "· Batch " + item.batch}
                  </small>
                </div>
              </div>
              <Status value={item.status} />
            </div>
            <h3>
              {item.degree} · Graduation {item.graduationYear}
            </h3>
            <p className="preserve">{item.reason}</p>
            <small>Requested {date(item.createdAt)}</small>
            {item.reviewedAt && <small>{item.status === "accepted" ? "Approved" : "Reviewed"} by {item.reviewedBy?.name || "Reviewer unavailable"} {item.reviewedBy?.role && `(${item.reviewedBy.role})`} · {date(item.reviewedAt)}</small>}
            {item.reviewNote && (
              <p className="review-note">Review: {item.reviewNote}</p>
            )}
            {item.status === "pending" && (
              <div className="actions">
                <button
                  className="primary"
                  onClick={() => setReview({ item, status: "accepted" })}
                >
                  Accept conversion
                </button>
                <button onClick={() => setReview({ item, status: "rejected" })}>
                  Reject request
                </button>
              </div>
            )}
          </article>
        ))
      ) : (
        <Empty>No requests match these filters.</Empty>
      )}
      <Pager {...{ data, page, setPage }} numbered />
      {review && (
        <Modal
          title={
            review.status === "accepted"
              ? "Accept Alumni conversion"
              : "Reject conversion request"
          }
          onClose={() => setReview(null)}
        >
          <p>
            {review.status === "accepted"
              ? "This promotes the same Student account to Alumni, preserving all history. Previous Student mentorships close, existing sessions expire, and the member must sign in again."
              : "The account stays Student. Explain your decision so the student knows what to correct."}
          </p>
          <Form
            fields={[
              {
                name: "reviewNote",
                label:
                  review.status === "accepted"
                    ? "Review note"
                    : "Reason for rejection (minimum 5 characters)",
                area: true,
                max: 1000,
                optional: review.status === "accepted",
              },
            ]}
            submit={
              review.status === "accepted"
                ? "Confirm acceptance"
                : "Confirm rejection"
            }
            onSubmit={async (values) => {
              const response = await api.patch(
                "/admin/conversions/" + review.item._id,
                { ...values, status: review.status },
              );
              setDone(response.data.message);
              setReview(null);
              reload();
            }}
          />
        </Modal>
      )}
    </>
  );
}

export function ConversationArchive() {
  const { id } = useParams(),
    [page, setPage] = useState(1),
    { data, error, loading } = useLoad(
      "/mentorships/" + id + "/archive/messages?page=" + page,
    );
  return (
    <>
      <Head
        title="Graduation conversation archive"
        description="Your original mentorship history, preserved in a read-only space."
      />
      <div className="management-help">
        <p>
          This Student mentorship closed when the student became Alumni.
          Original participants can read the history. Sending messages through
          this archive is disabled.
        </p>
      </div>
      <Notice error={error} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <section className="card">
            <h2>{data.relationship.title}</h2>
            <p>
              {data.relationship.student?.name} ·{" "}
              {data.relationship.mentor?.name}
            </p>
            {data.items.length ? (
              [...data.items].reverse().map((message) => (
                <article className="archive-message" key={message._id}>
                  <strong>{message.sender?.name}</strong>
                  {!message.deletedAt && (message.attachment || message.attachments?.length) && <ChatAttachments message={message}/>}
                  <p className="preserve">{message.body}</p>
                  <small>{date(message.createdAt)}</small>
                </article>
              ))
            ) : (
              <Empty>No messages were exchanged in this mentorship.</Empty>
            )}
          </section>
        )
      )}
      <Pager {...{ data, page, setPage }} numbered />
    </>
  );
}
