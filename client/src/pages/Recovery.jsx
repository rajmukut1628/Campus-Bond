import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, Brand, Form } from "../components/ui.jsx";
export function Recovery({ mode = "forgot-password" }) {
  const [message, setMessage] = useState(""),
    [token] = useState(
      () =>
        new URLSearchParams(window.location.hash.slice(1)).get("token") || "",
    );
  const reset = mode === "reset-password";
  return (
    <main className="recovery-page">
      <section className="card recovery-card">
        <Brand />
        <span className="eyebrow">ACCOUNT SECURITY</span>
        <h1>
          {reset
            ? "A fresh start."
            : "Let’s get you back in."}
        </h1>
        <p>
          {reset
            ? "Choose a new password of at least 11 characters."
            : "Enter your account email. We’ll send a secure password recovery link if it matches an eligible account."}
        </p>
        {message ? (
          <div className="success" role="status">
            {message}
          </div>
        ) : (
          <Form
            key={mode}
            fields={
              reset
                ? [
                    {
                      name: "password",
                      label: "New password",
                      type: "password",
                      minLength: 11,
                    },
                  ]
                : [{ name: "email", type: "email" }]
            }
            submit={
              reset
                ? "Reset password"
                : "Send secure link"
            }
            onSubmit={async (values) => {
              const r = await api.post(`/auth/${mode}`, {
                ...values,
                ...(reset ? { token } : {}),
              });
              setMessage(r.data.message);
              window.history.replaceState(null, "", window.location.pathname);
            }}
          />
        )}
        <Link className="button" to="/login">
          Back to sign in →
        </Link>
      </section>
    </main>
  );
}
