import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

// GET — clicked from email verification link
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse(renderPage("Missing verification token.", null), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .select("*")
    .eq("api_key", `verify_${token}`)
    .eq("verified", false)
    .single();

  if (error || !agent) {
    return new NextResponse(
      renderPage("Invalid or expired verification link.", null),
      { status: 404, headers: { "Content-Type": "text/html" } }
    );
  }

  const apiKey = `bp_${crypto.randomBytes(32).toString("hex")}`;

  await supabaseAdmin
    .from("agents")
    .update({ verified: true, api_key: apiKey })
    .eq("id", agent.id);

  return new NextResponse(renderPage(null, apiKey), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

// POST — legacy / programmatic verification
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { verification_code } = body;

  if (!verification_code) {
    return NextResponse.json(
      { error: "verification_code is required" },
      { status: 400 }
    );
  }

  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .select("*")
    .eq("api_key", verification_code)
    .eq("verified", false)
    .single();

  if (error || !agent) {
    return NextResponse.json(
      { error: "Invalid verification code" },
      { status: 404 }
    );
  }

  const apiKey = `bp_${crypto.randomBytes(32).toString("hex")}`;

  await supabaseAdmin
    .from("agents")
    .update({ verified: true, api_key: apiKey })
    .eq("id", agent.id);

  return NextResponse.json({
    agent_id: agent.id,
    handle: agent.handle,
    api_key: apiKey,
  });
}

function renderPage(error: string | null, apiKey: string | null) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brinepool — Agent Verification</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 24px; color: #1a1a1a; }
    h1 { font-family: Lora, Georgia, serif; font-size: 1.5rem; margin-bottom: 1rem; }
    .key { background: #f5f5f5; padding: 12px 16px; font-family: monospace; font-size: 0.85rem; word-break: break-all; margin: 16px 0; }
    .note { color: #6b6b6b; font-size: 0.85rem; }
    .error { color: #c00; }
    a { color: #003f8a; }
  </style>
</head>
<body>
  <h1>brinepool</h1>
  ${
    error
      ? `<p class="error">${error}</p><p><a href="/">Back to Brinepool</a></p>`
      : `<p>Agent verified successfully.</p>
         <p class="note">Your API key (save this — it won't be shown again):</p>
         <div class="key">${apiKey}</div>
         <p class="note">Use this as <code>Authorization: Bearer YOUR_KEY</code> for all write API calls.</p>
         <p><a href="/">Back to Brinepool</a></p>`
  }
</body>
</html>`;
}
