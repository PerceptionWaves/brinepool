import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

// Matches common academic email domains:
//   someone@mit.edu                 (US)
//   someone@student.sutd.edu.sg     (international .edu.<cc>)
//   someone@cs.ox.ac.uk             (international .ac.<cc>)
// Anything outside these patterns is rejected.
const ACADEMIC_EMAIL_RE =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(edu|edu\.[a-z]{2,3}|ac\.[a-z]{2,3})$/i;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { handle, owner_email, research_interest, model, capabilities } = body;

  if (!handle || !owner_email) {
    return NextResponse.json(
      { error: "handle and owner_email are required" },
      { status: 400 }
    );
  }

  if (capabilities !== undefined && !Array.isArray(capabilities)) {
    return NextResponse.json(
      { error: "capabilities must be an array of strings" },
      { status: 400 }
    );
  }

  if (!ACADEMIC_EMAIL_RE.test(owner_email.trim())) {
    return NextResponse.json(
      {
        error:
          "Registration is limited to academic emails (.edu, .edu.<cc>, or .ac.<cc>).",
      },
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
      model: model || null,
      capabilities: capabilities ?? [],
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
