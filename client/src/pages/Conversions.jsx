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
  const { user } = useAuth(),
    [page, setPage] = useState(1),
    [done, setDone] = useState(""),
    { data, error, loading, reload } = useLoad("/conversions?page=" + page);
  return (
    <>
      <Head
        title="Your next chapter: Alumni"
        description="Graduation changes your role, not your university history."
      />
      <div className="conversion-intro card">
        <GraduationCap size={34} />
        <div>
          <h2>Keep your account. Grow your network.</h2>
          <p>
            Your ID, posts, jobs, event registrations and contribution history
            remain on the same account. An Administrator reviews your graduation
            details. Once approved, sign in again as Alumni.
          </p>
          <small>
            Previous Student mentorships close on conversion; their history
            remains stored. Alumni can opt in to mentor new students from their
            profile.
          </small>
        </div>
      </div>
      <Notice error={error} />
      {done && (
        <div className="success" role="status">
          {done}
        </div>
      )}
      {user.role === "alumni" ? (
        <div className="success">
          <CheckCircle2 size={18} />
          Your account is already Alumni.
        </div>
      ) : data?.pending ? (
        <div className="management-help">
          <p>
            Your conversion request is awaiting review. You can continue using
            your Student account.
          </p>
        </div>
      ) : (
        !loading && (
          <section className="card">
            <h2>Request conversion</h2>
            <p>
              {user.department || "Department not assigned"} ·{" "}
              {user.batch ? "Batch " + user.batch : "Batch not assigned"} ·{" "}
              {user.universityId}
            </p>
            <Form
              fields={[
                { name: "degree", label: "Completed degree or qualification" },
                {
                  name: "graduationYear",
                  label: "Graduation year",
                  type: "number",
                  min: 1950,
                  max: new Date().getFullYear(),
                },
                {
                  name: "reason",
                  label:
                    "Graduation details for the reviewer (minimum 10 characters)",
                  area: true,
                  max: 2000,
                },
              ]}
              submit="Send conversion request"
              onSubmit={async (values) => {
                await api.post("/conversions", values);
                setDone("Your Alumni conversion request has been sent.");
                setPage(1);
                reload();
              }}
            />
          </section>
        )
      )}
      <h2>Request history</h2>
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        data.items.map((item) => (
          <article className="card" key={item._id}>
            <div className="row between">
              <h2>
                {item.degree} · {item.graduationYear}
              </h2>
              <Status value={item.status} />
            </div>
            <p className="preserve">{item.reason}</p>
            <small>Requested {date(item.createdAt)}</small>
            {item.reviewedAt && <small>Reviewed {date(item.reviewedAt)}</small>}
            {item.reviewNote && (
              <p className="review-note">Reviewer: {item.reviewNote}</p>
            )}
          </article>
        ))
      ) : (
        <Empty>No conversion requests yet.</Empty>
      )}
      <Pager {...{ data, page, setPage }} numbered />
    </>
  );
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
            placeholder="Name, email or university ID"
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
