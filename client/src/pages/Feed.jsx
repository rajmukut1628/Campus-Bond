import React, { useState, useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  RefreshCw,
  SlidersHorizontal,
  Clock,
  Eye,
  MessageCircle,
  Link2,
  ThumbsUp,
  ArrowUpRight,
  Sparkles,
  Newspaper,
  Send,
} from "lucide-react";
import {
  api,
  useAuth,
  admin,
  useLoad,
  Head,
  Avatar,
  Notice,
  Loading,
  Empty,
  Pager,
  Form,
  Action,
  Modal,
  date,
  errorText,
} from "../components/ui.jsx";
function Interests({ onSaved }) {
  const { user, setUser } = useAuth(),
    { data } = useLoad("/feed/options"),
    [selected, setSelected] = useState(user.interests || []),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  return (
    <section className="card interest-card">
      <span className="eyebrow">MAKE IT YOURS</span>
      <h2>
        <SlidersHorizontal size={19} /> Your interests
      </h2>
      <p>
        Choose what moves you. Unseen matching posts appear first in For you.
      </p>
      <div className="topic-picker">
        {data?.topics.map((topic) => (
          <button
            key={topic}
            aria-pressed={selected.includes(topic)}
            onClick={() => {
              setSaved(false);
              setSelected((v) =>
                v.includes(topic)
                  ? v.filter((t) => t !== topic)
                  : [...v, topic],
              );
            }}
          >
            {topic}
          </button>
        ))}
      </div>
      <Notice error={error} />
      <button
        className="primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await api.patch("/users/me", { interests: selected });
            setUser(r.data.user);
            setSaved(true);
            onSaved();
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : saved ? "Interests updated" : "Save interests"}
      </button>
    </section>
  );
}
function Comments({ post, onChanged }) {
  const { user } = useAuth(),
    [page, setPage] = useState(1),
    { data, error, loading, reload } = useLoad(
      `/feed/${post.kind}/${post._id}/comments?page=${page}`,
    );
  return (
    <section className="feed-comments">
      <h3>Conversation</h3>
      <Notice error={error} />
      <Form
        fields={[
          {
            name: "body",
            label: "Add a thoughtful comment",
            area: true,
            max: 2000,
          },
        ]}
        submit="Send comment"
        onSubmit={async (v) => {
          await api.post(`/feed/${post.kind}/${post._id}/comments`, v);
          setPage(1);
          reload();
          onChanged();
        }}
      />
      {loading ? (
        <Loading />
      ) : (
        data?.items.map((c) => (
          <div className="comment-row" key={c._id}>
            <Avatar user={c.author} />
            <div className="comment-bubble">
              <strong>{c.author?.name || "Former member"}</strong>
              <small>
                {c.author?.role} · {date(c.createdAt)}
              </small>
              <p className="preserve">{c.body}</p>
              {(admin(user) || user._id === c.author?._id) && (
                <Action
                  run={async () => {
                    await api.delete(`/feed/comments/${c._id}`);
                    reload();
                    onChanged();
                  }}
                >
                  Delete comment
                </Action>
              )}
            </div>
          </div>
        ))
      )}
      <Pager {...{ data, page, setPage }} />
    </section>
  );
}
function FeedCard({ post, onChanged, detail = false }) {
  const { user } = useAuth(),
    ref = useRef(null),
    seen = useRef(false),
    [stats, setStats] = useState(post.stats),
    [comments, setComments] = useState(false),
    [managing, setManaging] = useState(false),
    [reacting, setReacting] = useState(false),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [link, setLink] = useState(""),
    [editing, setEditing] = useState(false);
  useEffect(() => setStats(post.stats), [post.stats]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (
            e.isIntersecting &&
            !seen.current &&
            e.intersectionRatio >= 0.25
          ) {
            seen.current = true;
            api
              .post(`/feed/${post.kind}/${post._id}/view`)
              .then(() => setStats((s) => ({ ...s, viewed: true })))
              .catch(() => {
                seen.current = false;
              });
          }
      },
      { threshold: [0.25] },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [post.kind, post._id]);
  const refreshStats = async () => {
    try {
      setStats(
        (await api.get(`/feed/${post.kind}/${post._id}`)).data.item.stats,
      );
    } catch (e) {
      setError(errorText(e));
    }
  };
  const total = Object.values(stats?.reactions || {}).reduce(
      (a, b) => a + b,
      0,
    ),
    own = post.author?._id === user._id;
  return (
    <article
      ref={ref}
      className={`card premium-feed-card compact-feed-card ${detail ? "feed-detail" : ""}`}
    >
      <div className="feed-author">
        <Link to={`/app/members/${post.author?._id}`}>
          <Avatar user={post.author} />
        </Link>
        <div>
          <strong>{post.author?.name || "University community"}</strong>
          <small>
            <span className="role-chip">{post.author?.role}</span> ·{" "}
            {date(post.createdAt)}
          </small>
        </div>
        <span className="feed-type">
          {post.kind === "posts"
            ? "Community"
            : post.kind === "jobs"
              ? "Opportunity"
              : post.kind === "events"
                ? "Campus event"
                : "Give back"}
        </span>
        {(admin(user) || own) && (
          <button
            className="feed-manage-trigger"
            aria-label="Manage post"
            onClick={() => setManaging(true)}
          >
            Manage
          </button>
        )}
      </div>
      {post.cover && (
        <Link to={`/app/${post.kind}/${post._id}`} className="feed-cover">
          <img src={post.cover} alt={`${post.title} cover`} loading="lazy" />
        </Link>
      )}
      <div className="feed-story">
        {post.title && (
          <h2>
            <Link to={`/app/${post.kind}/${post._id}`}>{post.title}</Link>
          </h2>
        )}
        <p className="preserve">
          {detail ? post.body : post.body?.slice(0, 260)}
          {!detail && post.body?.length > 260 && "…"}
        </p>
        {!detail && post.kind === "posts" && (
          <Link className="feed-read-more" to={`/app/feed/posts/${post._id}`}>
            View full post →
          </Link>
        )}
        {post.kind === "jobs" && (
          <div className="feed-facts">
            <span>{post.company}</span>
            <span>{post.location}</span>
            <span>{post.workMode}</span>
            {post.salary && <span>{post.salary}</span>}
          </div>
        )}
        {post.kind === "events" && (
          <div className="feed-facts">
            <span>{post.mode === "recap" ? "Past event / Recap" : date(post.startsAt)}</span>
            <span>{post.location}</span>
            {post.mode !== "recap" && <span>{post.capacity} places</span>}
          </div>
        )}
        {post.kind === "donations" && (
          <div className="feed-facts">
            <span>{post.mode === "information" ? "Official help information" : `৳${(post.total || 0).toLocaleString()} raised · ৳${(post.remaining ?? post.goal)?.toLocaleString()} remaining`}</span>
            {post.beneficiary && <span>{post.beneficiary}</span>}
          </div>
        )}
        <div className="feed-topics">
          {post.topics?.slice(0, 3).map((t) => (
            <span key={t}>#{t.replaceAll(" ", "")}</span>
          ))}
        </div>
        {post.kind !== "posts" && (
          <Link
            className="button feed-open"
            to={`/app/${post.kind}/${post._id}`}
          >
            {post.kind === "jobs"
              ? "Explore opportunity"
              : post.kind === "events"
                ? "View event & participate"
                : "Support this cause"}
            <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
      <div className="feed-counts">
        <span>
          {total} {total === 1 ? "reaction" : "reactions"}
        </span>
        <span>
          {stats?.viewed ? "Viewed · " : ""}
          {stats?.comments || 0} comments · {stats?.shares || 0} shares
        </span>
      </div>
      <div className="feed-actions">
        <button
          className="feed-like"
          aria-pressed={stats?.myReaction === "love"}
          disabled={reacting}
          onClick={async () => {
            setError("");
            setReacting(true);
            try {
              await api.put(`/feed/${post.kind}/${post._id}/reaction`, {
                reaction: stats?.myReaction === "love" ? "" : "love",
              });
              await refreshStats();
            } catch (e) {
              setError(errorText(e));
            } finally {
              setReacting(false);
            }
          }}
        >
          Like
        </button>
        <button onClick={() => setComments(!comments)}>
          <MessageCircle size={17} /> Comment
        </button>
        <button
          onClick={async () => {
            setError("");
            try {
              const r = await api.post(`/feed/${post.kind}/${post._id}/share`),
                url = window.location.origin + r.data.path;
              setLink(url);
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            } catch (e) {
              setError(errorText(e));
            }
          }}
        >
          <Link2 size={17} />
          {copied ? "Link copied" : "Share"}
        </button>
      </div>
      {link && (
        <div className="share-note">
          {copied
            ? "Copied. A share is counted when another member opens the link."
            : "Copy this link:"}
          {!copied && (
            <input
              aria-label="Share link"
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
            />
          )}
        </div>
      )}
      <Notice error={error} />
      {managing && (
        <Modal title="Manage post" onClose={() => setManaging(false)}>
          <div className="feed-moderation">
            {post.kind !== "posts" && (
              <Link className="button" to={`/app/${post.kind}/${post._id}`}>
                Edit / manage details
              </Link>
            )}
            {post.kind === "posts" && (
              <button
                onClick={() => {
                  setManaging(false);
                  setEditing(true);
                }}
              >
                Edit
              </button>
            )}
            {admin(user) &&
              ["hidden", "archived", "published", "deleted"]
                .filter((v) => v !== (post.visibility || "published"))
                .map((v) => (
                  <Action
                    key={v}
                    run={async () => {
                      await api.patch(
                        `/feed/${post.kind}/${post._id}/visibility`,
                        { visibility: v },
                      );
                      setManaging(false);
                      onChanged();
                    }}
                  >
                    {v === "published"
                      ? "Show"
                      : v === "hidden"
                        ? "Hide"
                        : v === "archived"
                          ? "Archive"
                          : "Delete"}
                  </Action>
                ))}
          </div>
        </Modal>
      )}
      {comments && (
        <Modal title="Comments" onClose={() => setComments(false)}>
          <div className="compact-comment-dialog">
            <Comments post={post} onChanged={refreshStats} />
          </div>
        </Modal>
      )}
      {editing && (
        <Modal title="Edit community post" onClose={() => setEditing(false)}>
          <Form
            fields={[{ name: "body", area: true, max: 5000 }]}
            initial={post}
            onSubmit={async (v) => {
              await api.patch(`/posts/${post._id}`, v);
              setEditing(false);
              onChanged();
            }}
          />
        </Modal>
      )}
    </article>
  );
}
export function Feed() {
  const { user } = useAuth(),
    [page, setPage] = useState(1),
    [mode, setMode] = useState("for-you"),
    [cutoff, setCutoff] = useState(() => new Date().toISOString()),
    [visibility, setVisibility] = useState("archived"),
    [compose, setCompose] = useState(false),
    [topic, setTopic] = useState("Community"),
    [refreshed, setRefreshed] = useState(""),
    { data, error, loading, reload } = useLoad(
      `/feed?mode=${mode}&visibility=${visibility}&page=${page}&cutoff=${encodeURIComponent(cutoff)}`,
    ),
    { data: options } = useLoad("/feed/options");
  const refresh = () => {
    setCutoff(new Date().toISOString());
    setPage(1);
    reload();
    setRefreshed(new Date().toLocaleTimeString());
  };
  return (
    <>
      <Head
        eyebrow="THE COMMUNITY EDIT"
        title="A little closer. A lot more connected."
        description="Fresh perspectives, new opportunities and moments worth sharing."
      >
        <button className="primary" onClick={refresh} disabled={loading}>
          <RefreshCw size={17} /> Refresh feed
        </button>
      </Head>
      <div className="premium-feed-layout">
        <main className="feed-stream">
          <div className="feed-tabs">
            {[
              ["for-you", "For you", Sparkles],
              ["latest", "Latest", Clock],
              ["viewed", "Viewed feed", Eye],
              ...(admin(user)
                ? [["moderation", "Moderation", SlidersHorizontal]]
                : []),
            ].map(([value, label, Icon]) => (
              <button
                key={value}
                className={mode === value ? "selected" : ""}
                onClick={() => {
                  setMode(value);
                  setPage(1);
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
          {refreshed && (
            <small className="feed-refreshed" role="status">
              Updated at {refreshed}
            </small>
          )}
          {mode === "moderation" && (
            <label className="card">
              Visibility
              <select
                aria-label="Moderation visibility"
                value={visibility}
                onChange={(e) => {
                  setVisibility(e.target.value);
                  setPage(1);
                }}
              >
                {["archived", "hidden", "published"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          )}
          {admin(user) && (
            <section className="card feed-composer">
              <div className="row">
                <Avatar user={user} />
                <button onClick={() => setCompose(!compose)}>
                  Share an update with your university…
                </button>
              </div>
              {compose && (
                <>
                  <label>
                    Topic
                    <select
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    >
                      {options?.topics.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <Form
                    fields={[
                      {
                        name: "body",
                        label: "Your community update",
                        area: true,
                        max: 5000,
                      },
                    ]}
                    submit="Publish post"
                    onSubmit={async (v) => {
                      await api.post("/posts", { ...v, topics: [topic] });
                      setCompose(false);
                      refresh();
                    }}
                  />
                </>
              )}
            </section>
          )}
          <Notice error={error} />
          {loading ? (
            <Loading />
          ) : data?.items.length ? (
            data.items.map((post) => (
              <FeedCard
                key={`${post.kind}-${post._id}`}
                post={post}
                onChanged={reload}
              />
            ))
          ) : (
            <Empty>
              {mode === "viewed"
                ? "Posts you have seen will appear here."
                : "You’re up to date. Refresh for new posts, or open Latest and Viewed feed."}
            </Empty>
          )}
          <Pager {...{ data, page, setPage }} numbered />
        </main>
        <aside className="feed-sidebar">
          <section className="card feed-welcome">
            <span className="eyebrow">YOUR INNER CIRCLE</span>
            <Avatar user={user} large />
            <h2>Hello, {user.name.split(" ")[0]}.</h2>
            <p>Your university. Your people. Your next possibility.</p>
            <Link to="/app/profile">
              Make your profile shine <ArrowUpRight size={15} />
            </Link>
          </section>
          <Interests
            onSaved={() => {
              setMode("for-you");
              refresh();
            }}
          />
          <section className="card">
            <h3>
              <Newspaper size={18} /> Across your community
            </h3>
            <p>
              Jobs, events and causes come together here. Latest is always
              ordered newest first.
            </p>
            <Link to="/app/jobs">Explore careers →</Link>
            <Link to="/app/events">Find an event →</Link>
            <Link to="/app/donations">Give back →</Link>
          </section>
        </aside>
      </div>
    </>
  );
}
export function FeedPost() {
  const { kind, id } = useParams(),
    [params] = useSearchParams(),
    { data, error, loading, reload } = useLoad(`/feed/${kind}/${id}`);
  const share = params.get("share");
  useEffect(() => {
    if (share && data?.item)
      api
        .post(`/feed/${kind}/${id}/share-view`, { token: share })
        .then(reload)
        .catch(() => {});
  }, [kind, id, share, !!data?.item]);
  return (
    <>
      <Head title="From your community">
        <Link className="button" to="/app/feed">
          Back to Newsfeed
        </Link>
      </Head>
      <Notice error={error} />
      {loading ? (
        <Loading />
      ) : (
        data?.item && (
          <div className="feed-single">
            <FeedCard post={data.item} detail onChanged={reload} />
          </div>
        )
      )}
    </>
  );
}
