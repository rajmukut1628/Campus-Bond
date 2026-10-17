import React, { useState, useEffect } from "react";
import { batchForTerm, SEASONS } from "../lib/batches.js";
export function BatchPicker({ value = "", onChange, name, label = "Batch", optional = true, disabled = false }) {
  const [mode, setMode] = useState(value ? "manual" : ""), [year, setYear] = useState(""), [season, setSeason] = useState("");
  const calculated = batchForTerm(year, season);
  useEffect(() => { if (!value && calculated) { setYear(""); setSeason(""); } }, [value, calculated]);
  return <fieldset className="batch-picker" disabled={disabled}>
    <legend>{label}{optional && " (optional)"}</legend>
    <label>Entry method<select value={mode} required={!optional} onChange={e => { setMode(e.target.value); setYear(""); setSeason(""); onChange(""); }}>
      <option value="">Choose a method…</option><option value="term">Year &amp; season</option><option value="manual">Enter manually</option>
    </select></label>
    {mode === "term" && <>
      <div className="batch-term-fields">
        <label>Year<select value={year} required onChange={e => { setYear(e.target.value); if (season && !batchForTerm(e.target.value, season)) setSeason(""); onChange(batchForTerm(e.target.value, season)); }}><option value="">Choose year…</option>{Array.from({length:151}, (_,i)=>1950+i).map(y=><option key={y} disabled={!batchForTerm(y, "Fall")}>{y}</option>)}</select></label>
        <label>Season<select value={season} required onChange={e => { setSeason(e.target.value); onChange(batchForTerm(year,e.target.value)); }}><option value="">Choose season…</option>{SEASONS.map(s=><option key={s} disabled={!!year && !batchForTerm(year,s)}>{s}</option>)}</select></label>
      </div>
      {year && season && <p role="status">{calculated ? `${season} ${year} → Batch ${calculated}` : "No positive batch matches this term. Enter the batch manually."}</p>}
      <label className="batch-calculated">Batch number<input aria-label="Calculated batch" readOnly value={value} placeholder="Select year and season" /></label>
    </>}
    {mode === "manual" && <label>Batch number<input value={value} maxLength={60} required={!optional} placeholder="Enter batch number" onChange={e=>onChange(e.target.value)} /></label>}
    {name && <input type="hidden" name={name} value={value} />}
  </fieldset>;
}
export function BatchFormField({ initial = "", ...props }) {
  const [value, setValue] = useState(initial);
  return <BatchPicker {...props} value={value} onChange={setValue} />;
}
