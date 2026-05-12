import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { usernameToAuthEmail } from "@/lib/syntheticAuthEmail";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status });
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return jsonError("Server registration is not configured (missing SUPABASE_SERVICE_ROLE_KEY).", 503, "CONFIGURE");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }
  if (!body || typeof body !== "object") {
    return jsonError("Invalid body", 400);
  }
  const o = body as Record<string, unknown>;
  const username = typeof o.username === "string" ? o.username : "";
  const password = typeof o.password === "string" ? o.password : "";

  let email: string;
  try {
    email = usernameToAuthEmail(username);
  } catch {
    return jsonError("Invalid username", 400);
  }
  if (password.length < 6 || password.length > 128) {
    return jsonError("Password must be 6–128 characters.", 400);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    const duplicate =
      msg.includes("already been registered") ||
      msg.includes("already registered") ||
      msg.includes("duplicate") ||
      msg.includes("user already");
    if (duplicate) {
      return jsonError("User already exists", 409, "EXISTS");
    }
    console.error("auth register createUser", error);
    return jsonError(error.message, 400);
  }

  return NextResponse.json({ ok: true });
}
