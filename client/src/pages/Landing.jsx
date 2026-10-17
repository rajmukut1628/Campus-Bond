import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  GraduationCap,
  Users,
  BriefcaseBusiness,
  ShieldCheck,
  HeartHandshake,
  Sparkles,
  CalendarDays,
  Pause,
  Play,
  Network,
} from "lucide-react";
import { Brand, useAuth } from "../components/ui.jsx";
import "./welcome.css";

function NetworkScene() {
  return <div className="welcome-scene welcome-clean-scene" aria-hidden="true">
    <div className="welcome-scene-surface">
      <div className="welcome-scene-grid" />
      <div className="welcome-universe">
        <div className="welcome-orbit welcome-orbit-outer"><i/><i/></div>
        <div className="welcome-orbit welcome-orbit-middle"><i/></div>
        <div className="welcome-orbit welcome-orbit-inner" />
        <div className="welcome-core-halo" />
        <div className="welcome-core"><div className="welcome-core-shine"/><GraduationCap size={43} strokeWidth={1.35}/><strong>NUB<br/>CONNECT</strong></div>
        <div className="welcome-orbit-traveler"><span/></div>
        {[0,1,2,3,4,5,6,7].map(i=><span className={`welcome-star welcome-star-${i}`} key={i}/>)}
      </div>
    </div>
  </div>;
}

export function Landing() {
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
      tag: "THE PEOPLE",
      title: "Good connections change everything.",
      description:
        "Find familiar faces, exchange perspectives and learn from the people who have walked your path.",
      path: "/app/feed",
      label: "Meet your community",
    },
    {
      Icon: BriefcaseBusiness,
      index: "02",
      tag: "THE POSSIBILITIES",
      title: "Your next step starts closer.",
      description:
        "Discover opportunities shared by your network. Turn a conversation into your next career move.",
      path: "/app/jobs",
      label: "Explore opportunities",
    },
    {
      Icon: CalendarDays,
      index: "03",
      tag: "THE MOMENTS",
      title: "Stay part of something bigger.",
      description:
        "Come together for campus events and meaningful causes. Keep the connection going, wherever life takes you.",
      path: "/app/events",
      label: "Find your next moment",
    },
  ];
  return (
    <div className="welcome" data-motion={paused ? "paused" : "playing"}>
      <a className="welcome-skip" href="#welcome-main">
        Skip to content
      </a>
      <div className="welcome-ambient welcome-ambient-one" aria-hidden="true" />
      <div className="welcome-ambient welcome-ambient-two" aria-hidden="true" />
      <div className="welcome-page-grid" aria-hidden="true" />
      <div className="welcome-shell">
        <header className="welcome-header">
          <div className="welcome-brand">
            <Brand />
            <span>Your university. Your people.</span>
          </div>
          <nav aria-label="Welcome navigation">
            <a href="#welcome-explore">The possibilities</a>
            <Link className="button welcome-nav-login" to={destination}>
              {user ? "Open community" : "Member sign in"}
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
                Your university journey is only the beginning. Find your people,
                learn from alumni and open the door to what comes next.
              </p>
              <div className="welcome-hero-actions">
                <Link
                  className="button primary welcome-main-cta"
                  to={destination}
                >
                  {user ? "Your community awaits" : "Step into your community"}
                  <ArrowUpRight size={18} />
                </Link>
                <a href="#welcome-explore" className="welcome-secondary-cta">
                  Explore the possibilities
                  <ArrowRight size={15} />
                </a>
              </div>
              <div className="welcome-trust">
                <span className="welcome-trust-mark">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <strong>Real people. A shared beginning.</strong>
                  <span>
                    University-verified accounts · Meaningful connections
                  </span>
                </div>
              </div>
              <div className="welcome-hero-footnote">
                <span>FOR YOUR NEXT CHAPTER</span>
                <span className="welcome-fine-line" />
                <Sparkles size={13} />
              </div>
            </div>
            <div className="welcome-visual">
              <NetworkScene />
              {!reduced && <div className="welcome-visual-footer"><button className="welcome-motion-control" onClick={()=>setPaused(!paused)} aria-pressed={paused} aria-label={paused ? "Play welcome animation" : "Pause welcome animation"}>{paused ? <Play size={15}/> : <Pause size={15}/>}</button></div>}
            </div>
          </section>
          <section
            className="welcome-explore"
            id="welcome-explore"
            aria-labelledby="welcome-explore-heading"
          >
            <div className="welcome-section-head">
              <div>
                <span className="welcome-section-eyebrow">
                  THE BEST PART OF UNIVERSITY? THE PEOPLE.
                </span>
                <h2 id="welcome-explore-heading">
                  More than a network.
                  <br />
                  <span>A place to keep growing.</span>
                </h2>
              </div>
              <p>
                From your first day on campus to your next big move.
                <br />
                Some connections stay with you.
              </p>
            </div>
            <div className="welcome-feature-grid">
              {features.map(
                ({ Icon, index, tag, title, description, path, label }) => (
                  <Link
                    key={index}
                    className="welcome-feature"
                    to={user ? path : "/login"}
                    state={user ? undefined : { from: path }}
                  >
                    <div className="welcome-feature-top">
                      <span>
                        <Icon size={22} strokeWidth={1.5} />
                      </span>
                      <small>{index}</small>
                    </div>
                    <span className="welcome-feature-tag">{tag}</span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                    <span className="welcome-feature-link">
                      {label}
                      <ArrowUpRight size={15} />
                    </span>
                  </Link>
                ),
              )}
            </div>
          </section>
          <section className="welcome-closing">
            <div className="welcome-closing-symbol" aria-hidden="true">
              <GraduationCap size={25} />
            </div>
            <div>
              <span className="welcome-section-eyebrow">
                WHEREVER YOU GO NEXT
              </span>
              <h2>You will always have a community.</h2>
            </div>
            <Link className="button" to={destination}>
              Make your next connection
              <ArrowUpRight size={16} />
            </Link>
          </section>
        </main>
        <footer className="welcome-footer">
          <Brand />
          <span>© {new Date().getFullYear()} NUB Connect</span>
          <span>One beginning. Endless possibilities.</span>
        </footer>
      </div>
    </div>
  );
}
