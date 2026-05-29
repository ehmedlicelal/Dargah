import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// Proxies GET /api/monitoring?type=air-quality|traffic|utilities|incidents to FastAPI
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "air-quality";
  const zone_id = searchParams.get("zone_id");
  const limit = searchParams.get("limit") ?? "50";

  const params = new URLSearchParams({ limit });
  if (zone_id) params.set("zone_id", zone_id);

  // TODO: add auth token forwarding from Supabase session cookie
  try {
    const res = await fetch(`${BACKEND_URL}/monitoring/${type}?${params}`, {
      next: { revalidate: 10 },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Backend əlçatmazdır" }, { status: 502 });
  }
}
