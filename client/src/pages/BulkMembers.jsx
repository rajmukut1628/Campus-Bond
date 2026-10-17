import { BatchPicker } from "../components/BatchPicker.jsx";
import React, { useState, useRef } from "react";
import {
  Users,
  Upload,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { api, Modal, Notice, errorText } from "../components/ui.jsx";
import { parseMembers, resultCsv } from "../lib/member-import.js";
function download(name, text) {
  const url = URL.createObjectURL(
      new Blob([text], { type: "text/csv;charset=utf-8" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const template =
  "name,email,universityId,department,batch,role\nSample Member,member@example.com,STU-001,CSE,50,student\n";
export function BulkMembers({ options, onClose, onCreated }) {
  const [source, setSource] = useState(""),
    [members, setMembers] = useState([]),
    [defaults, setDefaults] = useState({
      role: "student",
      department: "",
      batch: "",
    }),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [preview, setPreview] = useState(null),
    [setupExpanded, setSetupExpanded] = useState(true),
    [results, setResults] = useState([]),
    [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    stop = useRef(false);
  const locked = busy || checking || done;
  const invalidate = () => {
    setPreview(null);
    setResults([]);
    setError("");
  };
  const resolved = () =>
    members.map((row) =>
      Object.fromEntries(
        ["name", "email", "universityId", "department", "batch", "role", "phone"].map(
          (k) => [k, row[k] || defaults[k] || ""],
        ),
      ),
    );
  const parse = (text) => {
    try {
      setMembers(
        parseMembers(text).map((row) => ({
          ...row,
          ...(row.role ? { role: row.role.toLowerCase() } : {}),
          ...(row.department
            ? {
                department:
                  options?.departments?.find(
                    (d) => d.toLowerCase() === row.department.toLowerCase(),
                  ) || row.department,
              }
            : {}),
        })),
      );
      invalidate();
    } catch (e) {
      setError(e.message);
    }
  };
  const check = async () => {
    setError("");
    setChecking(true);
    try {
      if (!members.length) throw Error("Add at least one member.");
      const r = await api.post("/admin/users/bulk-preview", {
        members: resolved().map((member) => ({ ...member, password })),
      });
      setPreview(r.data);
      setSetupExpanded(false);
      setResults([]);
    } catch (e) {
      setError(errorText(e));
      setPreview(null);
    } finally {
      setChecking(false);
    }
  };
  const create = async () => {
    if (!preview?.ready || busy || done) return;
    stop.current = false;
    setBusy(true);
    setError("");
    const next = preview.items.map((row) => ({
      ...row.member,
      status: row.valid ? "not_created" : "skipped",
      message: row.errors.map((e) => e.message).join("; "),
    }));
    setResults([...next]);
    try {
      for (const row of preview.items.filter((r) => r.valid)) {
        if (stop.current) break;
        next[row.index] = { ...next[row.index], status: "creating" };
        setResults([...next]);
        try {
          const response = await api.post("/admin/users", {
            ...row.member,
            password,
          });
          next[row.index] = {
            ...next[row.index],
            status: "created",
            accountId: response.data.user._id,
            message: "Account created. Ready to sign in.",
          };
        } catch (e) {
          const status = e.response?.status;
          next[row.index] = {
            ...next[row.index],
            status:
              !status || status >= 500
                ? "check_required"
                : status === 409
                  ? "skipped"
                  : "failed",
            message: errorText(e),
          };
          if (!status || status === 401 || status === 403 || status >= 500) {
            stop.current = true;
            setError(
              "Import stopped. Accounts already created remain saved. Recheck the list before retrying; a connection failure may have occurred after an account was saved.",
            );
          }
        }
        setResults([...next]);
      }
    } finally {
      setBusy(false);
      setDone(true);
      onCreated(next.filter((r) => r.status === "created").length);
    }
  };
  const created = results.filter((r) => r.status === "created").length,
    processed = results.filter((r) =>
      ["created", "skipped", "failed", "check_required"].includes(r.status),
    ).length;
  return (
    <Modal
      title="Add multiple members"
      onClose={onClose}
      closeDisabled={busy || checking}
    >
      <div className="bulk-members">
        <div className="bulk-intro">
          <span className="bulk-icon">
            <Users size={23} />
          </span>
          <div>
            <h3>A whole class. One simple import.</h3>
            <p>
              Add up to 100 Students or Alumni. Review first, then create the
              valid accounts together.
            </p>
          </div>
        </div>
        <Notice error={error} />
        {!!members.length && !done && (
          <div className="bulk-settings-toggle">
            <span>
              {preview
                ? "Review the checked rows below."
                : "Rows can override the common settings."}
            </span>
            <button
              disabled={locked}
              onClick={() => setSetupExpanded(!setupExpanded)}
            >
              {setupExpanded ? "Hide settings" : "Edit import settings"}
            </button>
          </div>
        )}
        {!done && setupExpanded && (
          <fieldset disabled={locked} className="bulk-defaults">
            <legend>Common account settings</legend>
            <label>
              Default role
              <select
                value={defaults.role}
                onChange={(e) => {
                  setDefaults({ ...defaults, role: e.target.value });
                  invalidate();
                }}
              >
                <option value="student">Student</option>
                <option value="alumni">Alumni</option>
              </select>
            </label>
            <label>
              Default department
              <select
                value={defaults.department}
                onChange={(e) => {
                  setDefaults({ ...defaults, department: e.target.value });
                  invalidate();
                }}
              >
                <option value="">Choose department…</option>
                {options?.departments?.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <BatchPicker label="Common batch" value={defaults.batch} disabled={locked} onChange={batch => { setDefaults({ ...defaults, batch }); invalidate(); }} />
            <label>
              Initial password for these accounts
              <span className="password-input">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={11}
                  maxLength={72}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    invalidate();
                  }}
                />
                <button
                  type="button"
                  aria-label={
                    showPassword
                      ? "Hide import password"
                      : "Show import password"
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
              <small>
                Minimum 11 characters. Passwords stay out of CSV templates and
                result downloads.
              </small>
            </label>
          </fieldset>
        )}
        {!done && setupExpanded && (
          <section className="bulk-source">
            <div className="bulk-source-head">
              <h3>Paste a list or upload CSV</h3>
              <button
                disabled={locked}
                onClick={() => download("member-import-template.csv", template)}
              >
                <Download size={14} /> Template
              </button>
            </div>
            <p>
              Include <strong>name, email, universityId</strong> headers.
              Department, batch, role and phone columns are optional and override
              common settings. Paste rows copied from Excel, or save Excel as
              CSV.
            </p>
            <textarea
              disabled={locked}
              aria-label="Paste member list"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={
                "name,email,universityId\nSample Member,member@example.com,STU-001"
              }
              rows={4}
            />
            <div className="row wrap">
              <button
                disabled={locked || !source.trim()}
                onClick={() => parse(source)}
              >
                Load pasted list
              </button>
              <label className="bulk-file">
                <Upload size={14} /> Upload CSV / TSV
                <input
                  disabled={locked}
                  type="file"
                  accept=".csv,.tsv,text/csv,text/tab-separated-values"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      if (file.size > 256 * 1024)
                        throw Error("Choose a CSV/TSV file up to 256 KB.");
                      const text = await file.text();
                      setSource(text);
                      parse(text);
                    } catch (error) {
                      setError(error.message);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                disabled={locked || members.length >= 100}
                onClick={() => {
                  setMembers([
                    ...members,
                    { name: "", email: "", universityId: "" },
                  ]);
                  invalidate();
                }}
              >
                <Plus size={14} /> Add a row
              </button>
            </div>
          </section>
        )}
        {!!members.length && (
          <>
            <div className="bulk-review-head">
              <h3>{members.length} members to review</h3>
              {preview && (
                <span>
                  {preview.ready} ready · {preview.invalid} need attention
                </span>
              )}
            </div>
            <div className="bulk-table-wrap">
              <table className="bulk-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>University ID</th>
                    <th>Phone</th>
                    <th>Department</th>
                    <th>Batch</th>
                    <th>Role</th>
                    <th>Result</th>
                    {!locked && <th />}
                  </tr>
                </thead>
                <tbody>
                  {members.map((row, index) => {
                    const report = results[index],
                      validation = preview?.items[index];
                    return (
                      <tr
                        key={index}
                        className={
                          report?.status === "created"
                            ? "bulk-row-created"
                            : validation && !validation.valid
                              ? "bulk-row-invalid"
                              : ""
                        }
                      >
                        <td>{index + 1}</td>
                        {[
                          "name",
                          "email",
                          "universityId",
                          "phone",
                          "department",
                          "batch",
                          "role",
                        ].map((key) => (
                          <td key={key}>
                            {["department", "role"].includes(key) ? (
                              <select
                                aria-label={`${key} for member ${index + 1}`}
                                disabled={locked}
                                value={row[key] || ""}
                                onChange={(e) => {
                                  setMembers(
                                    members.map((r, i) =>
                                      i === index
                                        ? { ...r, [key]: e.target.value }
                                        : r,
                                    ),
                                  );
                                  invalidate();
                                }}
                              >
                                <option value="">Use default</option>
                                {row[key] &&
                                  !(
                                    key === "role"
                                      ? ["student", "alumni"]
                                      : options?.departments || []
                                  ).includes(row[key]) && (
                                    <option value={row[key]}>
                                      {row[key]} (check value)
                                    </option>
                                  )}
                                {(key === "role"
                                  ? ["student", "alumni"]
                                  : options?.departments || []
                                ).map((v) => (
                                  <option key={v}>{v}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                aria-label={`${key} for member ${index + 1}`}
                                disabled={locked}
                                value={row[key] || ""}
                                maxLength={
                                  key === "name"
                                    ? 100
                                    : key === "email"
                                      ? 180
                                      : 60
                                }
                                type={key === "email" ? "email" : "text"}
                                placeholder={defaults[key] || ""}
                                onChange={(e) => {
                                  setMembers(
                                    members.map((r, i) =>
                                      i === index
                                        ? { ...r, [key]: e.target.value }
                                        : r,
                                    ),
                                  );
                                  invalidate();
                                }}
                              />
                            )}
                          </td>
                        ))}
                        <td className="bulk-row-result">
                          <strong>
                            {report?.status.replaceAll("_", " ") ||
                              (validation
                                ? validation.valid
                                  ? "Ready"
                                  : "Needs attention"
                                : "Not checked")}
                          </strong>
                          <small>
                            {report?.message ||
                              validation?.errors
                                .map((e) => e.message)
                                .join("; ")}
                          </small>
                        </td>
                        {!locked && (
                          <td>
                            <button
                              aria-label={`Remove member ${index + 1}`}
                              onClick={() => {
                                setMembers(
                                  members.filter((_, i) => i !== index),
                                );
                                invalidate();
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {busy && (
          <div className="bulk-progress" role="status">
            <progress value={created} max={preview.ready} />
            <strong>
              Creating accounts… {created} / {preview.ready} saved
            </strong>
            <p>
              Keep this page open until account creation completes. No verification emails are sent.
            </p>
            <button
              onClick={() => {
                stop.current = true;
              }}
            >
              Stop after current account
            </button>
          </div>
        )}
        {done && (
          <div className="bulk-summary" role="status">
            <CheckCircle2 size={22} />
            <div>
              <strong>
                {created} accounts created · ready to sign in
              </strong>
              <p>
                {results.filter((r) => r.status === "skipped").length} skipped ·{" "}
                {
                  results.filter((r) =>
                    ["failed", "check_required"].includes(r.status),
                  ).length
                }{" "}
                need review ·{" "}
                {results.filter((r) => r.status === "not_created").length} not
                created. Members can sign in directly with their assigned credentials.
              </p>
            </div>
          </div>
        )}
        <div className="bulk-footer">
          {!done && !busy && (
            <>
              <button disabled={checking || !members.length} onClick={check}>
                {checking ? "Checking…" : "Check & preview"}
              </button>
              {preview?.ready > 0 && (
                <button
                  className="primary"
                  disabled={checking}
                  onClick={create}
                >
                  Create {preview.ready} valid{" "}
                  {preview.ready === 1 ? "account" : "accounts"}
                  {preview.invalid ? ` · skip ${preview.invalid}` : ""}
                </button>
              )}
            </>
          )}
          {done && (
            <>
              <button
                onClick={() =>
                  download("member-import-results.csv", resultCsv(results))
                }
              >
                <Download size={15} /> Download results
              </button>
              <button
                onClick={() => {
                  setDone(false);
                  setPreview(null);
                  setResults([]);
                  setError("");
                }}
              >
                Recheck list
              </button>
              <button className="primary" onClick={onClose}>
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
