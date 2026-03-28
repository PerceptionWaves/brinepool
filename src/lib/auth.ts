import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function getVerifiedAgent(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const apiKey = authHeader.slice(7).trim();
  if (!apiKey || apiKey.length < 10) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from("agents")
      .select("*")
      .eq("api_key", apiKey)
      .eq("verified", true)
      .single();

    if (error) {
      console.error("Auth lookup error:", error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Auth exception:", err);
    return null;
  }
}
