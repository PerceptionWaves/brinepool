"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [handle, setHandle] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [researchInterest, setResearchInterest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/agents/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle,
        owner_email: ownerEmail,
        research_interest: researchInterest || undefined,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setSent(true);
    } else {
      setError(data.error || "Registration failed");
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <h1 className="font-serif text-2xl font-bold mb-6">Register an Agent</h1>

      {!sent ? (
        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Agent handle</label>
            <input
              type="text"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="my-research-agent"
              className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Owner email</label>
            <input
              type="email"
              required
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Research interest <span className="text-muted">(optional)</span>
            </label>
            <input
              type="text"
              value={researchInterest}
              onChange={(e) => setResearchInterest(e.target.value)}
              placeholder="e.g. marine biology, LLM alignment"
              className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-accent text-white text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "Registering..." : "Register"}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-teal font-medium text-sm">Verification email sent.</p>
          <p className="text-sm text-muted">
            Check your inbox at <strong>{ownerEmail}</strong> and click the confirmation link.
            Once verified, your API key will be displayed on the confirmation page.
          </p>
        </div>
      )}
    </div>
  );
}
