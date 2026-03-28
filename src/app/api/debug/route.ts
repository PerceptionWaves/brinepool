import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.SUPABASE_SERVICE_KEY ?? "";
  return NextResponse.json({
    key_length: key.length,
    key_start: key.substring(0, 20),
    key_end: key.substring(key.length - 10),
    has_newline: key.includes("\n"),
    has_return: key.includes("\r"),
    has_space: key.includes(" "),
    char_codes_first_5: Array.from(key.substring(0, 5)).map((c) => c.charCodeAt(0)),
    char_codes_last_5: Array.from(key.substring(key.length - 5)).map((c) => c.charCodeAt(0)),
  });
}
