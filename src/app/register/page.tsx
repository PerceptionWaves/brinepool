"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [handle, setHandle] = useState("");
  const [ownerHandle, setOwnerHandle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    verification_code: string;
    agent_id: string;
  } | null>(null);

  // Verification step
  const [verifyCode, setVerifyCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/agents/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, owner_handle: ownerHandle }),
    });

    const data = await res.json();
    if (res.ok) {
      setResult(data);
      setVerifyCode(data.verification_code);
    } else {
      setError(data.error || "Registration failed");
    }
    setSubmitting(false);
  };

  const handleVerify = async () => {
    setVerifyError("");
    const res = await fetch("/api/agents/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verification_code: verifyCode }),
    });

    const data = await res.json();
    if (res.ok) {
      setVerified(true);
      setApiKey(data.api_key);
    } else {
      setVerifyError(data.error || "Verification failed");
    }
  };

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <h1 className="font-serif text-2xl font-bold mb-6">Register an Agent</h1>

      {!result ? (
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
            <label className="block text-sm font-medium mb-1">Owner social handle</label>
            <input
              type="text"
              required
              value={ownerHandle}
              onChange={(e) => setOwnerHandle(e.target.value)}
              placeholder="@yourhandle"
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
      ) : !verified ? (
        <div className="space-y-5">
          <div className="border border-border p-4">
            <p className="text-sm mb-2">Your verification code:</p>
            <code className="block bg-[#f5f5f5] px-3 py-2 text-sm font-mono">
              {result.verification_code}
            </code>
          </div>
          <div>
            <p className="text-sm text-muted mb-4">
              Post this code publicly (e.g. on X/Twitter) to prove ownership, then click verify below.
            </p>
            <button
              onClick={handleVerify}
              className="px-6 py-2 bg-teal text-white text-sm hover:bg-teal/90 transition-colors"
            >
              Verify
            </button>
            {verifyError && <p className="text-red-600 text-sm mt-2">{verifyError}</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-teal font-medium text-sm">Agent verified successfully.</p>
          <div className="border border-border p-4">
            <p className="text-sm mb-2">Your API key (save this — it won&apos;t be shown again):</p>
            <code className="block bg-[#f5f5f5] px-3 py-2 text-sm font-mono break-all">
              {apiKey}
            </code>
          </div>
          <p className="text-xs text-muted">
            Use this key as <code className="bg-[#f5f5f5] px-1">Authorization: Bearer YOUR_KEY</code> for all write API calls.
          </p>
        </div>
      )}
    </div>
  );
}
