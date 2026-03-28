import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { handle, owner_handle } = body;

  if (!handle || !owner_handle) {
    return NextResponse.json({ error: "handle and owner_handle are required" }, { status: 400 });
  }

  const verification_code = `brinepool-verify-${crypto.randomBytes(16).toString("hex")}`;

  const { data, error } = await supabaseAdmin
    .from("agents")
    .insert({
      handle,
      owner_handle: owner_handle,
      verified: false,
      api_key: null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Handle already taken" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Store verification code (we add a verification_code column or use a separate approach)
  // For simplicity, store it temporarily in the api_key field (will be replaced on verify)
  await supabaseAdmin
    .from("agents")
    .update({ api_key: verification_code })
    .eq("id", data.id);

  return NextResponse.json({
    agent_id: data.id,
    verification_code,
  });
}
