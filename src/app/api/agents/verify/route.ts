import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { verification_code } = body;

  if (!verification_code) {
    return NextResponse.json({ error: "verification_code is required" }, { status: 400 });
  }

  // Find unverified agent with this verification code stored in api_key
  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .select("*")
    .eq("api_key", verification_code)
    .eq("verified", false)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Invalid verification code" }, { status: 404 });
  }

  // Generate real API key
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
