import { readFeedPosition, saveFeedPosition } from "../lib/feedNavigation.js";
import { useFeedCache } from "./useFeedCache.js";
import React, { useState, useEffect, useRef } from "react";
import { Link, useParams, useSearchParams, useLocation, useNavigate } from "react-router-dom";
import {
  Code2, Building2, FlaskConical, Palette, GraduationCap, Activity, Trophy, Leaf, Check,
  CalendarDays,
  HeartHandshake,
  BriefcaseBusiness,
  Maximize2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Bookmark,
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
const interestDetails = {
  Technology: [Code2, "Software, innovation and digital skills"],
  Careers: [BriefcaseBusiness, "Jobs, internships and career guidance"],
  Business: [Building2, "Entrepreneurship and industry insights"],
  Science: [FlaskConical, "Research and scientific discoveries"],
  "Arts & Culture": [Palette, "Creativity, culture and campus life"],
  Education: [GraduationCap, "Learning and academic opportunities"],
  Health: [Activity, "Wellbeing and health initiatives"],
  Sports: [Trophy, "Sports and team activities"],
  Community: [HeartHandshake, "Connections and community updates"],
  Environment: [Leaf, "Sustainability and environmental action"],
};
function Interests({ onSaved, onCancel }) {
  const { user, setUser } = useAuth();
  const { data, loading, error: optionsError, reload } = useLoad("/feed/options");
  const [selected, setSelected] = useState(user.interests || []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const guidance = {
    student: "Choose the topics you want to learn about and explore.",
    alumni: "Choose topics that support your professional and community interests.",
    admin: "Personalize your feed. Your moderation access stays unchanged.",
    superadmin: "Personalize your feed. Platform oversight stays unchanged.",
  }[user.role];
  return <form className="interest-editor" aria-busy={busy} onSubmit={async event => {
    event.preventDefault();
    if(saving.current || loading || optionsError || !data?.topics?.length) return;
    saving.current=true; setBusy(true); setError("");
    try {
      const response=await api.patch("/users/me",{interests:selected.filter(topic=>data.topics.includes(topic))});
      setUser(response.data.user); onSaved();
    } catch(e) { setError(errorText(e)); }
    finally { saving.current=false; setBusy(false); }
  }}>
    <div className="interest-intro"><span className="interest-intro-icon"><Sparkles size={22}/></span><div><span className="eyebrow">YOUR FOR YOU FEED</span><p>{guidance}</p></div></div>
    <Notice error={optionsError || error} onRetry={optionsError ? reload : undefined}/>
    {loading && !data ? <Loading/> : <fieldset disabled={busy} className="interest-fields">
      <legend className="sr-only">Choose your interests</legend>
      <div className="interest-selection-summary"><span>{selected.length ? selected.length+" selected" : "All topics"}</span><button type="button" disabled={!selected.length} onClick={()=>setSelected([])}>Clear selection</button></div>
      <div className="interest-options">{data?.topics.map(topic=>{
        const [Icon,description]=interestDetails[topic] || [Newspaper,"Community posts and updates"];
        const active=selected.includes(topic);
        return <button className="interest-option" type="button" key={topic} aria-pressed={active} onClick={()=>setSelected(current=>current.includes(topic)?current.filter(value=>value!==topic):[...current,topic])}>
          <span className="interest-option-icon"><Icon size={19}/></span><span><strong>{topic}</strong><small>{description}</small></span><span className="interest-option-check">{active && <Check size={14}/>}</span>
        </button>;
      })}</div>
      <p className="interest-explanation">{selected.length ? "Recommended shows unseen posts matching your choices. Use All posts to browse everything." : "No topics selected: Recommended shows unseen posts from all topics."} Saved only for your account.</p>
      <div className="interest-actions"><button type="button" onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={loading || !!optionsError || !data?.topics?.length}>{busy ? "Saving…" : "Save preferences"}</button></div>
    </fieldset>}
  </form>;
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
function FeedCard({ post, onChanged, onFavoriteChanged = () => {}, detail = false, fromFeed = false }) {
  const { user } = useAuth(),
    ref = useRef(null),
    seen = useRef(false),
    [stats, setStats] = useState(post.stats),
    [comments, setComments] = useState(false),
    [managing, setManaging] = useState(false),
    [reacting, setReacting] = useState(false),
    [savingFavorite, setSavingFavorite] = useState(false),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [link, setLink] = useState(""),
    [editing, setEditing] = useState(false),
    [preview, setPreview] = useState(false);
  useEffect(() => setStats(post.stats), [post.stats]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (
            e.isIntersecting &&
            !seen.current &&
            e.intersectionRatio >= 0.5
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
      { threshold: [0.5] },
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
  const fullDescription = post.body || post.description || "";
  const compactDescription = fullDescription.replace(/\s+/g," ").trim();
  const excerpt = compactDescription.length > 360 ? compactDescription.slice(0,360).replace(/\s+\S*$/, "") + "..." : compactDescription;
  const total = Object.values(stats?.reactions || {}).reduce(
      (a, b) => a + b,
      0,
    ),
    own = post.author?._id === user._id;
  return (
    <article
      className={`card premium-feed-card compact-feed-card ${detail ? "feed-detail" : ""}`}
    >
      <div className="feed-author" ref={ref}>
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
        <span className={`feed-type feed-category-badge category-${post.kind}`}>
          {post.kind === "events" ? <CalendarDays size={14}/> : post.kind === "donations" ? <HeartHandshake size={14}/> : post.kind === "jobs" ? <BriefcaseBusiness size={14}/> : <Newspaper size={14}/>}
          <span>{post.kind === "posts" ? "Community" : post.kind === "jobs" ? "Opportunity" : post.kind === "events" ? "Campus event" : "Give back"}</span>
        </span>
        <button type="button" className={`feed-bookmark ${stats?.favorite ? "saved" : ""}`} aria-label={stats?.favorite ? "Remove from Favorites" : "Add to Favorites"} title={stats?.favorite ? "Remove from Favorites" : "Add to Favorites"} aria-pressed={!!stats?.favorite} disabled={savingFavorite} onClick={async () => {
          const previous = !!stats?.favorite, favorite = !previous;
          setSavingFavorite(true); setError(""); setStats(s => ({...s, favorite}));
          try { await api.put(`/feed/${post.kind}/${post._id}/favorite`, {favorite}); onFavoriteChanged(post.kind, post._id, favorite); }
          catch (e) { setStats(s => ({...s, favorite:previous})); setError(errorText(e)); }
          finally { setSavingFavorite(false); }
        }}><Bookmark size={18} fill={stats?.favorite ? "currentColor" : "none"}/></button>
        {(admin(user) || own) && (
          <button
            className="feed-manage-trigger"
            aria-label="Manage post"
            onClick={() => setManaging(true)}
          >
            <MoreHorizontal size={20} />
          </button>
        )}
      </div>
      {post.cover && (
        <button type="button" className="feed-cover feed-image-frame" aria-label={`View full image: ${post.title || "Post"}`} onClick={() => setPreview(true)}>
          <img className="feed-image-backdrop" src={post.cover} alt="" aria-hidden="true" loading="lazy" />
          <img className="feed-image-full" src={post.cover} alt={post.title || "Post cover"} loading="lazy" />
          <span className="feed-image-expand" aria-hidden="true"><Maximize2 size={16}/></span>
        </button>
      )}
      <div className="feed-story">
        {post.title && (
          <h2>
            <Link state={fromFeed ? {fromFeed:true} : undefined} to={post.kind === "posts" ? `/app/feed/posts/${post._id}` : `/app/${post.kind}/${post._id}`}>{post.title}</Link>
          </h2>
        )}
        {fullDescription && <p className={detail ? "preserve feed-description-full" : "feed-description-preview"}>{detail ? fullDescription : excerpt}</p>}
        {!detail && post.kind === "posts" && (
          <Link className="feed-read-more feed-details-link" state={fromFeed ? {fromFeed:true} : undefined} to={`/app/feed/posts/${post._id}`}>
            View details <ArrowUpRight size={15}/>
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
            className="button feed-open feed-details-link"
            state={fromFeed ? {fromFeed:true} : undefined}
            to={`/app/${post.kind}/${post._id}`}
          >
            View details
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
        <button aria-expanded={comments} onClick={() => setComments(!comments)}>
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
      {preview && <Modal title={post.title || "Post image"} onClose={() => setPreview(false)}>
        <div className="feed-image-preview"><img src={post.cover} alt={post.title || "Post cover"}/><a href={post.cover} target="_blank" rel="noreferrer">Open original image <ArrowUpRight size={15}/></a></div>
      </Modal>}
      {managing && (
        <Modal title="Manage post" onClose={() => setManaging(false)}>
          <div className="feed-moderation">
            {post.kind !== "posts" && (
              <Link className="button" to={`/app/${post.kind}/${post._id}`}>
                Manage details
              </Link>
            )}
            {post.kind === "posts" && (user.role === "superadmin" || String(post.author?._id || post.author) === String(user._id)) && (
              <button
                onClick={() => {
                  setManaging(false);
                  setEditing(true);
                }}
              >
                Edit
              </button>
            )}
            {own && !admin(user) && post.kind === "posts" && <Action run={async () => { await api.delete(`/posts/${post._id}`); setManaging(false); onChanged(); }}>Delete my post</Action>}
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
  const { user } = useAuth();
  const location=useLocation(), positionKey=`${user._id}:${user.role}:${location.key}`;
  const [initial]=useState(()=>{const saved=readFeedPosition(positionKey);return saved?.mode === "moderation" && !admin(user) ? null : saved;});
  const feedElement=useRef(null), restoreScroll=useRef(initial?.scroll ?? null), currentPosition=useRef(null);
  const [page, setPage] = useState(initial?.page || 1), [mode, setMode] = useState(initial?.mode || "for-you"), [order, setOrder] = useState(initial?.order || "recommended"),
    [cutoff, setCutoff] = useState(initial?.cutoff || null),
    [windowBusy,setWindowBusy] = useState(false), [windowError,setWindowError] = useState(""),
    [visibility, setVisibility] = useState(initial?.visibility || "hidden"),
    [compose, setCompose] = useState(false), [interests, setInterests] = useState(false),
    [creating, setCreating] = useState(false), [topic, setTopic] = useState("Community"), [draftLength,setDraftLength]=useState(0),
    [refreshed, setRefreshed] = useState("");
  const feedUrl = (value, nextPage = page) => cutoff ? `/feed?mode=${value === "for-you" && order === "newest" ? "latest" : value}&visibility=${visibility}&page=${nextPage}&cutoff=${encodeURIComponent(cutoff)}` : null;
  const { data, error, loading, refreshing, reload, prefetch, updateFavorite } = useFeedCache(feedUrl(mode), `${user._id}:${user.role}:${JSON.stringify([...(user.interests || [])].sort())}`);
  const { data: options, error:optionsError } = useLoad("/feed/options");
  useEffect(()=>{if(!cutoff && options?.feedCutoff) setCutoff(options.feedCutoff);},[cutoff,options]);
  const refresh = async () => {
    setWindowBusy(true);setWindowError("");
    try {const response=await api.get("/feed/options");setCutoff(response.data.feedCutoff);setPage(1);reload({keepPrevious:true});setRefreshed(new Date().toLocaleTimeString());}
    catch(e){setWindowError(errorText(e));} finally{setWindowBusy(false);}
  };
  const selectMode = value => { setMode(value); setPage(1); };
  currentPosition.current={page,mode,order,cutoff,visibility,scroll:window.scrollY};
  useEffect(()=>{
    const remember=()=>{saveFeedPosition(positionKey,{...currentPosition.current,scroll:window.scrollY});};
    window.addEventListener("scroll",remember,{passive:true});
    const element=feedElement.current;
    element?.addEventListener("click",remember,true);
    return()=>{window.removeEventListener("scroll",remember);element?.removeEventListener("click",remember,true);};
  },[positionKey]);
  useEffect(()=>{
    if(loading || !data || restoreScroll.current === null)return;
    const target=restoreScroll.current;
    const frame=requestAnimationFrame(()=>{window.scrollTo({top:target,behavior:"instant"});restoreScroll.current=null;});
    return()=>cancelAnimationFrame(frame);
  },[loading,data]);
  const moderation = mode === "moderation";
  return <section ref={feedElement} className={`refined-feed role-${user.role}`}>
    <header className="refined-feed-heading feed-command-bar">
      <h1>{moderation ? (user.role === "superadmin" ? "Content oversight" : "Moderation") : "Newsfeed"}</h1>
    <div className="refined-feed-navigation">
      <div className="feed-tabs" role="group" aria-label="Newsfeed order">
        {[["for-you", "For you", Sparkles], ["favorites", "Favorites", Bookmark], ["viewed", "Viewed", Eye]].map(([value,label,Icon]) => <button key={value} aria-pressed={mode === value} className={mode === value ? "selected" : ""} onMouseEnter={() => prefetch(feedUrl(value, 1))} onFocus={() => prefetch(feedUrl(value, 1))} onClick={() => selectMode(value)}><Icon size={16}/>{label}</button>)}
      </div>
      {mode === "for-you" && <label className="feed-order"><select aria-label="For you sorting" value={order} onChange={e => {setOrder(e.target.value);setPage(1);}}><option value="recommended">Recommended · Unseen</option><option value="newest">All posts · Newest first</option></select></label>}
      {refreshed && <small className="feed-refreshed" role="status">Updated {refreshed}</small>}
    </div>
      <div className="refined-feed-tools">
        <button aria-label="Update interests" title="Interests" onClick={() => setInterests(true)}><SlidersHorizontal size={18}/><span>Interests</span></button>
        {admin(user) && <button aria-label={user.role === "superadmin" ? "Content oversight" : "Moderation"} title={user.role === "superadmin" ? "Content oversight" : "Moderation"} aria-pressed={moderation} onClick={() => selectMode(moderation ? "for-you" : "moderation")}><Eye size={18}/><span>{user.role === "superadmin" ? "Oversight" : "Moderation"}</span></button>}
        <button className="primary feed-publish-trigger" aria-label={admin(user) ? "Post update" : "Create post"} onClick={() => {setDraftLength(0);user.role === "alumni" ? setCreating(true) : setCompose(true);}}><Plus size={18}/><span>{admin(user) ? "Post update" : "Create post"}</span></button>
        <button aria-label="Refresh newsfeed" title="Refresh feed" disabled={refreshing || windowBusy} onClick={refresh}><RefreshCw size={18} className={refreshing || windowBusy ? "feed-refreshing" : ""}/></button>
      </div>
    </header>
    {moderation && <div className="refined-moderation-filter"><label>Show<select aria-label="Moderation visibility" value={visibility} onChange={e => {setVisibility(e.target.value);setPage(1);}}>{["hidden","archived","published"].map(v => <option key={v} value={v}>{v}</option>)}</select></label><small>{user.role === "superadmin" ? "Review, edit or moderate community posts." : "Review visibility and moderate posts. Authors manage their content."}</small></div>}
    <main className="feed-stream">
      <Notice error={error || windowError || optionsError}/>
      {loading ? <div className="feed-skeleton-list" role="status" aria-label="Loading posts">{[1,2].map(n => <div className="feed-skeleton" key={n}><div className="skeleton-author"/><div className="skeleton-line"/><div className="skeleton-line short"/><div className="skeleton-image"/></div>)}</div> : data?.items.length ? data.items.map(post => <FeedCard key={`${post.kind}-${post._id}`} post={post} fromFeed onChanged={reload} onFavoriteChanged={(kind,id,favorite)=>{updateFavorite(kind,id,favorite);if(mode === "favorites" && !favorite && data.items.length === 1 && page > 1) setPage(page-1);}}/>) : <Empty>{moderation ? "No posts match this visibility." : mode === "viewed" ? "Posts you have seen will appear here." : mode === "favorites" ? "No favorites yet. Bookmark a post to find it here." : mode === "for-you" && order === "recommended" ? <span className="feed-caught-up"><strong>No unseen recommendations right now.</strong><span>Update your interests, browse all posts or refresh for new updates.</span><button type="button" onClick={()=>{setOrder("newest");setPage(1);}}>Browse all posts <ArrowUpRight size={15}/></button></span> : "No posts yet."}</Empty>}
      {!loading && data?.total > 20 && <Pager {...{data,page,setPage}} numbered/>}
    </main>
    {interests && <Modal title="Your interests" onClose={() => setInterests(false)}><Interests onCancel={()=>setInterests(false)} onSaved={() => {setInterests(false);setOrder("recommended");selectMode("for-you");refresh();}}/></Modal>}
    {creating && <Modal title="Share with your community" onClose={() => setCreating(false)}>
      <div className="feed-publish-identity"><Avatar user={user}/><div><strong>{user.name}</strong><span>Alumni · Your university community</span></div></div>
      <div className="feed-create-options feed-publish-choices">
        <button type="button" onClick={()=>{setCreating(false);setCompose(true);}}><Newspaper size={21}/><span><strong>Community update</strong><small>Share your experience or a useful update.</small></span><ArrowUpRight size={16}/></button>
        {[["jobs","Career opportunity","Share a job or internship.",BriefcaseBusiness],["events","Event","Bring your community together.",CalendarDays],["donations","Give back","Share a fundraising or help campaign.",HeartHandshake]].map(([kind,label,description,Icon])=><Link key={kind} to={`/app/${kind}?create=true`} onClick={()=>setCreating(false)}><Icon size={21}/><span><strong>{label}</strong><small>{description}</small></span><ArrowUpRight size={16}/></Link>)}
      </div>
    </Modal>}
    {compose && <Modal title={admin(user) ? user.role === "superadmin" ? "Publish a platform update" : "Post a university update" : user.role === "alumni" ? "Share your experience" : "Share a community update"} onClose={() => setCompose(false)}>
      <div className={`feed-publish-panel publisher-${user.role}`} onInput={event=>{if(event.target.name === "body")setDraftLength(event.target.value.length);}}>
        <div className="feed-publish-identity"><Avatar user={user}/><div><strong>{user.name}</strong><span>{({student:"Student",alumni:"Alumni",admin:"Administrator",superadmin:"Super Admin"})[user.role]} · University community</span></div><span className="feed-publish-kind">Community update</span></div>
        <p className="feed-publish-guidance">{({student:"Share a campus moment, a question or something useful.",alumni:"Share your experience and insights with your university community.",admin:"Share a university announcement or a useful campus update.",superadmin:"Share a platform announcement with your university community."})[user.role]}</p>
        <Form fields={[{name:"body",label:"Your update",area:true,max:5000,placeholder:"What would you like to share?"},{name:"topic",label:"Topic",options:options?.topics?.length ? options.topics : ["Community"]}]} initial={{topic:options?.topics?.includes(topic) ? topic : options?.topics?.[0] || "Community"}} submit="Publish post" onSubmit={async v => {await api.post("/posts",{body:v.body,topics:[v.topic]});setTopic(v.topic);setCompose(false);refresh();}}/>
        <div className="feed-publish-footer"><span>Visible to signed-in community members</span><span>{draftLength.toLocaleString()} / 5,000</span></div>
      </div>
    </Modal>}
  </section>;
}
export function FeedPost() {
  const location=useLocation(), navigate=useNavigate();
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
        {location.state?.fromFeed ? <button type="button" onClick={()=>navigate(-1)}>Back to Newsfeed</button> : <Link className="button" to="/app/feed">Back to Newsfeed</Link>}
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
