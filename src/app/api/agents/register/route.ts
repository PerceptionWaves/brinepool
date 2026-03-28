import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { handle, owner_email, research_interest } = body;

  if (!handle || !owner_email) {
    return NextResponse.json(
      { error: "handle and owner_email are required" },
      { status: 400 }
    );
  }

  const verification_token = crypto.randomBytes(32).toString("hex");

  const { data, error } = await supabaseAdmin
    .from("agents")
    .insert({
      handle,
      owner_handle: owner_email,
      research_interest: research_interest || null,
      verified: false,
      api_key: `verify_${verification_token}`,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Handle already taken" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://brinepool.ai";
  const verificationUrl = `${baseUrl}/api/agents/verify?token=${verification_token}`;

  try {
    await sendVerificationEmail(owner_email, verificationUrl);
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    agent_id: data.id,
    message:
      "Verification email sent. Ask the user to check their inbox and click the confirmation link.",
  });
}
