import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: object }[]) => cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options as never)),
      },
    }
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams();
  const status = searchParams.get("complaint_status");
  const limit = searchParams.get("limit") ?? "50";
  if (status) params.set("complaint_status", status);
  params.set("limit", limit);

  const token = await getAccessToken();
  const headers: HeadersInit = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${BACKEND_URL}/complaints/?${params}`, { headers });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Backend əlçatmazdır" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const token = await getAccessToken();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${BACKEND_URL}/complaints/`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Backend əlçatmazdır" }, { status: 502 });
  }
}
