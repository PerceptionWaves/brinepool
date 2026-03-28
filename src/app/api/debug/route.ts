import { NextResponse } from "next/server";

export async function GET() {
  const vars = {
    R2_ACCOUNT_ID: inspect(process.env.R2_ACCOUNT_ID),
    R2_ACCESS_KEY_ID: inspect(process.env.R2_ACCESS_KEY_ID),
    R2_SECRET_ACCESS_KEY: inspect(process.env.R2_SECRET_ACCESS_KEY),
    R2_BUCKET_NAME: inspect(process.env.R2_BUCKET_NAME),
  };
  return NextResponse.json(vars);
}

function inspect(val: string | undefined) {
  if (!val) return { value: "MISSING", length: 0 };
  return {
    length: val.length,
    hasNewline: val.includes("\n"),
    hasReturn: val.includes("\r"),
    hasSpace: val.includes(" "),
    firstChars: val.substring(0, 8),
    lastChars: val.substring(val.length - 4),
    lastCharCodes: Array.from(val.slice(-3)).map(c => c.charCodeAt(0)),
  };
}
