const WORKER_ORIGIN = "https://wopt-prayer-push.wopt-windsor.workers.dev";

export const dynamic = "force-dynamic";

async function proxy(request: Request) {
  const incoming = new URL(request.url);
  const upstreamUrl = `${WORKER_ORIGIN}${incoming.pathname.replace(/^\/api/, "")}${incoming.search}`;

  const headers = new Headers();
  for (const name of ["content-type", "authorization", "x-admin-bootstrap-key"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
    cache: "no-store"
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);
    responseHeaders.set("cache-control", "no-store");

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders
    });
  } catch (error) {
    console.error("Admin CRM proxy failed", error);
    return Response.json({ error: "Admin API is temporarily unavailable" }, { status: 502 });
  }
}

export async function GET(request: Request) {
  return proxy(request);
}

export async function POST(request: Request) {
  return proxy(request);
}

export async function DELETE(request: Request) {
  return proxy(request);
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
