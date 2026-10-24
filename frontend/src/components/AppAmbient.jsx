import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

// One persistent scene per shell; route changes only adjust its emphasis.
export function AppAmbient({ variant }) {
  const { pathname } = useLocation();
  const [paused, setPaused] = useState(() => document.hidden);
  useEffect(() => {
    const update = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const section = pathname.split("/")[2] || "overview";
  const mode = variant || (section === "overview" ? "overview"
    : section === "feed" ? "feed"
    : section === "messages" ? "quiet"
    : ["jobs", "events", "donations", "mentors", "members"].includes(section) ? "header"
    : "subtle");
  return <div className="app-ambient" data-emphasis={mode} data-paused={paused} aria-hidden="true">
    <div className="app-ambient-glow" />
    <div className="app-ambient-orbits">
      <span className="app-ambient-ring"><i /></span>
      <span className="app-ambient-ring"><i /></span>
      <span className="app-ambient-ring" />
    </div>
  </div>;
}
