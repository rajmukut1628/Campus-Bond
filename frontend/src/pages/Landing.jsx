import { useTheme } from "../lib/theme.js";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sun,
  Moon,
  ArrowUpRight,
  GraduationCap,
  Users,
  BriefcaseBusiness,
  CalendarDays,
  Pause,
  Play,
} from "lucide-react";
import { useAuth } from "../components/ui.jsx";
import "./welcome.css";

export function NetworkScene({ CenterIcon = GraduationCap, label = "CampusBond" }) {
  return <div className="welcome-scene welcome-clean-scene" aria-hidden="true">
    <div className="welcome-scene-surface">
      <div className="welcome-scene-grid" />
      <div className="welcome-wide-aura" />
      <div className="welcome-wide-ring welcome-wide-ring-one"><i /></div>
      <div className="welcome-wide-ring welcome-wide-ring-two"><i /></div>
      <div className="welcome-wide-ring welcome-wide-ring-three" />
      <div className="welcome-universe">
        <div className="welcome-orbit welcome-orbit-outer"><i/><i/></div>
        <div className="welcome-orbit welcome-orbit-middle"><i/></div>
        <div className="welcome-orbit welcome-orbit-inner" />
        <div className="welcome-core-halo" />
        <div className="welcome-core"><div className="welcome-core-shine"/><CenterIcon size={43} strokeWidth={1.35}/><strong>{label}</strong></div>
        <div className="welcome-orbit-traveler"><span/></div>
        {[0,1,2,3,4,5,6,7].map(i=><span className={`welcome-star welcome-star-${i}`} key={i}/>)}
      </div>
    </div>
  </div>;
}

export function Landing() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth(),
    [paused, setPaused] = useState(false),
    [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)"),
      update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const destination = user ? "/app" : "/login";
  const features = [
    {
      Icon: Users,
      index: "01",
      title: "Mentorship",
      description:
        "Get guidance from alumni and build supportive professional relationships.",
    },
    {
      Icon: BriefcaseBusiness,
      index: "02",
      title: "Career opportunities",
      description:
        "Explore jobs and internships shared by your university network.",
    },
    {
      Icon: CalendarDays,
      index: "03",
      title: "Events & community support",
      description:
        "Take part in campus programs, blood donation and fundraising initiatives.",
    },
  ];
  return (
    <div className="welcome welcome-background-orbit welcome-fullscreen-orbit" data-motion={paused ? "paused" : "playing"}>
      <a className="welcome-skip" href="#welcome-main">
        Skip to content
      </a>
      <div className="welcome-ambient welcome-ambient-one" aria-hidden="true" />
      <div className="welcome-ambient welcome-ambient-two" aria-hidden="true" />
      <div className="welcome-page-grid" aria-hidden="true" />
      <div className="welcome-visual" aria-hidden="true"><NetworkScene /></div>
      <div className="welcome-shell">
        {!reduced && <button className="welcome-motion-control welcome-global-motion" onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={paused ? "Play welcome animation" : "Pause welcome animation"}>{paused ? <Play size={15}/> : <Pause size={15}/>}</button>}
        <header className="welcome-header">
          <div className="welcome-brand">
            <div className="brand" aria-label="CampusBond"><span className="brand-mark"><GraduationCap size={24} /></span><strong>CampusBond</strong></div>
          </div>
          <nav aria-label="Welcome navigation">
            <Link className="button welcome-nav-login" to={destination}>
              {user ? "Open community" : "Log in"}
              <ArrowUpRight size={15} />
            </Link>
          </nav>
        </header>
        <main id="welcome-main">
          <section className="welcome-hero">
            <div className="welcome-copy">
              <span className="welcome-eyebrow">
                <i /> ONE CAMPUS. A LIFETIME OF CONNECTIONS.
              </span>
              <h1>
                <span>A connection today.</span>
                <span>A possibility</span>
                <em>tomorrow.</em>
              </h1>
              <p>
                Connecting students, alumni and administrators of Northern
                University Bangladesh in one shared space.
              </p>
            </div>
          </section>
          <section
            className="welcome-explore"
            id="welcome-explore"
            aria-labelledby="welcome-explore-heading"
          >
            <div className="welcome-section-head">
              <h2 id="welcome-explore-heading">Built for your university community.</h2>
            </div>
            <div className="welcome-feature-grid">
              {features.map(
                ({ Icon, index, title, description }) => (
                  <article key={index} className="welcome-feature">
                    <div className="welcome-feature-top">
                      <span>
                        <Icon size={22} strokeWidth={1.5} />
                      </span>
                      <small>{index}</small>
                    </div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </article>
                ),
              )}
            </div>
          </section>
        </main>
        <footer className="welcome-footer">
          <div className="welcome-copyright-theme"><span>© {new Date().getFullYear()} CampusBond</span><button className="theme-toggle" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to sky blue theme" : "Switch to dark theme"} title={theme === "dark" ? "Sky blue theme" : "Dark theme"} aria-pressed={theme === "light"}>{theme === "dark" ? <Sun size={15}/> : <Moon size={15}/>}</button></div>
        </footer>
      </div>
    </div>
  );
}
