import { canAccessRoute } from "./route-access.js";
import { Landing } from "./pages/Landing.jsx";
import { Feed, FeedPost } from "./pages/Feed.jsx";
import { Recovery } from "./pages/Recovery.jsx";
import { Profile, MemberProfile } from "./pages/Profiles.jsx";
import {
  ConversionPage,
  ConversionReview,
  ConversationArchive,
} from "./pages/Conversions.jsx";
import { ActivityPage } from "./pages/Activity.jsx";
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
  Activity,
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

import "./style.css";
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
} from "./components/ui.jsx";
import {
  Login,
  Dashboard,
  Mentors,
  Requests,
  Messages,
} from "./pages/Community.jsx";
import {
  Resources,
  JobDetails,
  EventDetails,
  DonationDetails,
} from "./pages/Resources.jsx";
import {
  Notifications,
  Management,
  Unauthorized,
  NotFound,
} from "./pages/Account.jsx";
const navigation = [
  ["", "Overview", LayoutDashboard],
  ["feed", "Newsfeed", Globe],
  ["mentors", "Find a mentor", Users],
  ["requests", "Mentorships", HeartHandshake],
  ["messages", "Messages", MessagesSquare],
  ["jobs", "Career opportunities", BriefcaseBusiness],
  ["events", "Events", CalendarDays],
  ["donations", "Give back", HeartHandshake],
  ["notifications", "Notifications", Bell],
];
function Shell() {
  const { user, loading, setUser } = useAuth(),
    [open, setOpen] = useState(false),
    location = useLocation(),
    navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) return;
    let live = true;
    const refresh = async () => { if (document.hidden) return; try { const result = await api.get("/notifications/summary"); if (live) setUnread(result.data.unread); } catch {} };
    refresh(); const timer = setInterval(refresh, 20000);
    window.addEventListener("notifications-changed", refresh); window.addEventListener("focus", refresh);
    return () => { live = false; clearInterval(timer); window.removeEventListener("notifications-changed", refresh); window.removeEventListener("focus", refresh); };
  }, [user?._id]);
  useEffect(() => setOpen(false), [location.pathname]);
  if (loading) return <Loading />;
  if (!user)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (!canAccessRoute(user.role, location.pathname)) return <Navigate to="/app/feed" replace />;
  const items = navigation.filter(
    ([key]) =>
      !["mentors", "requests"].includes(key) ||
      ["student", "alumni"].includes(user.role),
  );
  return (
    <div className="app-shell">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <Brand />
        <div className="workspace-label">YOUR CAMPUS COMMUNITY</div>
        <nav>
          {items.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={`/app${path ? "/" + path : ""}`}
              end={path === ""}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
          {user.role === "student" && (
            <NavLink to="/app/conversion">
              <GraduationCap size={19} />
              Alumni conversion
            </NavLink>
          )}
          {admin(user) && (
            <>
              <div className="workspace-label">ADMINISTRATION</div>
              <NavLink to="/app/users">
                <Users size={19} />
                Manage members
              </NavLink>
              <NavLink to="/app/alumni-requests">
                <GraduationCap size={19} />
                Alumni requests
              </NavLink>
              <NavLink to="/app/verified">
                <ShieldCheck size={19} />
                Verified accounts
              </NavLink>
            </>
          )}
          {user.role === "superadmin" && (
            <>
              <NavLink to="/app/admins">
                <ShieldCheck size={19} />
                Manage admins
              </NavLink>
              <NavLink to="/app/activity">
                <Activity size={19} />
                Activity
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="community-card">
            <Sparkles size={19} />
            <strong>Better, together.</strong>
            <p>Your experience could be someone’s next big step.</p>
            <Link to="/app/profile">
              Complete your profile <ArrowUpRight size={14} />
            </Link>
          </div>
          <NavLink to="/app/profile">
            <Settings size={18} />
            Profile & settings
          </NavLink>
          <Action
            run={async () => {
              await api.post("/auth/logout");
              setUser(null);
              navigate("/", { replace: true, state: null });
            }}
          >
            <LogOut size={18} />
            Sign out
          </Action>
          <div className="user-chip">
            <Avatar user={user} />
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.role === "superadmin" ? "Super admin" : user.role}
              </small>
            </div>
            <span className="online" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Toggle navigation"
            onClick={() => setOpen(!open)}
          >
            <Menu size={20} />
          </button>
          <span className="breadcrumb">
            Your community <ChevronRight size={14} />{" "}
            <strong>
              {navigation.find(
                ([p]) => p === (location.pathname.split("/")[2] || ""),
              )?.[1] ||
                {
                  users: "Manage members",
                  verified: "Verified accounts",
                  admins: "Manage admins",
                  activity: "Activity",
                  profile: "Profile & settings",
                }[location.pathname.split("/")[2]] ||
                "Account"}
            </strong>
          </span>
          <div className="row">
            <span className="campus-badge">
              <span className="live-dot" /> UNIVERSITY NETWORK
            </span>
            <Link
              className="icon-link"
              to="/app/notifications"
              aria-label={`Notifications, ${unread} unread`}
            >
              <Bell size={20} />
              {unread > 0 && <span className="notification-badge">{unread > 99 ? "99+" : unread}</span>}
            </Link>
            <Link to="/app/profile">
              <Avatar user={user} />
            </Link>
          </div>
        </header>
        <main className="content">
          {location.state?.notice && (
            <div className="success" role="status">
              {location.state.notice}
            </div>
          )}
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="feed" element={<Feed />} />
            <Route path="feed/:kind/:id" element={<FeedPost />} />
            <Route path="mentors" element={<Mentors />} />
            <Route path="requests" element={<Requests />} />
            <Route path="messages" element={<Messages />} />
            <Route path="messages/:id" element={<Messages />} />
            <Route path="jobs" element={<Resources kind="jobs" />} />
            <Route path="jobs/:id" element={<JobDetails />} />
            <Route path="events" element={<Resources kind="events" />} />
            <Route path="events/:id" element={<EventDetails />} />
            <Route path="donations" element={<Resources kind="donations" />} />
            <Route path="donations/:id" element={<DonationDetails />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<Profile />} />
            <Route path="members/:id" element={<MemberProfile />} />
            <Route
              path="archives/:id"
              element={
                ["student", "alumni"].includes(user.role) ? (
                  <ConversationArchive />
                ) : (
                  <Unauthorized />
                )
              }
            />
            <Route
              path="conversion"
              element={
                ["student", "alumni"].includes(user.role) ? (
                  <ConversionPage />
                ) : (
                  <Unauthorized />
                )
              }
            />
            <Route
              path="alumni-requests"
              element={admin(user) ? <ConversionReview /> : <Unauthorized />}
            />
            <Route
              path="users"
              element={
                admin(user) ? <Management kind="users" /> : <Unauthorized />
              }
            />
            <Route
              path="verified"
              element={
                admin(user) ? <Management kind="verified" /> : <Unauthorized />
              }
            />
            <Route
              path="admins"
              element={
                user.role === "superadmin" ? (
                  <Management kind="admins" />
                ) : (
                  <Unauthorized />
                )
              }
            />
            <Route
              path="activity"
              element={
                user.role === "superadmin" ? <ActivityPage /> : <Unauthorized />
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <footer>
          NUB Connect <span>A community that moves you forward.</span>
        </footer>
      </div>
    </div>
  );
}
function EntryFallback() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <NotFound /> : <Navigate to="/login" replace />;
}
function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        {[
          "forgot-password",
          "reset-password",
        ].map((mode) => (
          <Route
            key={mode}
            path={`/${mode}`}
            element={<Recovery mode={mode} />}
          />
        ))}
        <Route path="/verify-email" element={<Navigate to="/login" replace />} />
        <Route path="/resend-verification" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/app/*" element={<Shell />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<EntryFallback />} />
      </Routes>
    </AuthProvider>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
