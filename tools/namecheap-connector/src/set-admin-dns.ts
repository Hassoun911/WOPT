import "dotenv/config";
import { NamecheapClient } from "./namecheap.js";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
};

const client = new NamecheapClient({
  apiUser: required("NAMECHEAP_API_USER"),
  apiKey: required("NAMECHEAP_API_KEY"),
  username: required("NAMECHEAP_USERNAME"),
  clientIp: required("NAMECHEAP_CLIENT_IP"),
  sandbox: process.env.NAMECHEAP_USE_SANDBOX === "true",
  allowedDomains: new Set((process.env.NAMECHEAP_ALLOWED_DOMAINS || "hassoun.app")
    .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean))
});

const result = await client.upsertHost("hassoun.app", {
  host: "admin",
  type: "CNAME",
  address: "e78651923118cef3.vercel-dns-017.com",
  ttl: 300
});

console.log(JSON.stringify({
  ok: true,
  domain: "admin.hassoun.app",
  type: "CNAME",
  target: "e78651923118cef3.vercel-dns-017.com",
  result
}, null, 2));
