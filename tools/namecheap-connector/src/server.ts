import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { detectPublicIpv4, NamecheapClient } from "./namecheap.js";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
};

const apiUser = required("NAMECHEAP_API_USER");
const apiKey = required("NAMECHEAP_API_KEY");
const username = required("NAMECHEAP_USERNAME");
const bearer = required("CONNECTOR_BEARER_TOKEN");
const allowedDomains = new Set((process.env.NAMECHEAP_ALLOWED_DOMAINS || "hassoun.app")
  .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean));
const port = Number(process.env.PORT || 8788);
const clientIp = process.env.NAMECHEAP_CLIENT_IP?.trim() || await detectPublicIpv4();

const nc = new NamecheapClient({
  apiUser,
  apiKey,
  username,
  clientIp,
  sandbox: process.env.NAMECHEAP_USE_SANDBOX === "true",
  allowedDomains
});

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

function createMcpServer() {
  const server = new McpServer({ name: "hassoun-namecheap", version: "1.0.0" });

  server.tool("namecheap_connection_info", "Show the connector's detected public IPv4 and allowed domains. Use the IPv4 for the Namecheap API whitelist.", {}, async () =>
    text({ clientIp, allowedDomains: [...allowedDomains], sandbox: process.env.NAMECHEAP_USE_SANDBOX === "true" })
  );

  server.tool("namecheap_get_dns", "Read all Namecheap DNS host records for an allowed domain.", {
    domain: z.string().default("hassoun.app")
  }, async ({ domain }) => text({ domain, records: await nc.getHosts(domain) }));

  server.tool("namecheap_upsert_dns", "Add or replace one DNS record. The connector backs up the full existing record set before writing and preserves unrelated records.", {
    domain: z.string().default("hassoun.app"),
    host: z.string().min(1).max(255),
    type: z.enum(["A", "AAAA", "CNAME", "MX", "MXE", "TXT", "URL", "URL301", "FRAME"]),
    address: z.string().min(1).max(2048),
    ttl: z.number().int().min(60).max(60000).optional(),
    mxPref: z.number().int().min(0).max(255).optional()
  }, async ({ domain, host, type, address, ttl, mxPref }) => text(await nc.upsertHost(domain, { host, type, address, ttl, mxPref })));

  server.tool("namecheap_delete_dns", "Delete matching DNS record(s) by host and optional type. A backup is created before the write.", {
    domain: z.string().default("hassoun.app"),
    host: z.string().min(1).max(255),
    type: z.string().optional()
  }, async ({ domain, host, type }) => text(await nc.deleteHost(domain, host, type)));

  return server;
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "128kb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "hassoun-namecheap-connector", clientIp, allowedDomains: [...allowedDomains] }));

app.use("/mcp", (req, res, next) => {
  const auth = req.header("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(bearer);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "Unauthorized" });
  next();
});

app.post("/mcp", async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).json({ error: "MCP request failed" });
  }
});

app.get("/mcp", (_req, res) => res.status(405).json({ error: "Stateless MCP endpoint uses POST" }));
app.delete("/mcp", (_req, res) => res.status(405).json({ error: "Stateless MCP endpoint uses POST" }));

app.listen(port, "127.0.0.1", () => {
  console.log(`Hassoun Namecheap connector listening on http://127.0.0.1:${port}`);
  console.log(`Namecheap ClientIp / whitelist IPv4: ${clientIp}`);
  console.log(`Allowed domains: ${[...allowedDomains].join(", ")}`);
});
