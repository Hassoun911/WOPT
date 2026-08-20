import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type DnsRecord = {
  host: string;
  type: string;
  address: string;
  ttl?: number;
  mxPref?: number;
};

type Config = {
  apiUser: string;
  apiKey: string;
  username: string;
  clientIp: string;
  sandbox: boolean;
  allowedDomains: Set<string>;
};

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function attrs(xmlTag: string) {
  const out: Record<string, string> = {};
  for (const match of xmlTag.matchAll(/([A-Za-z0-9_]+)="([^"]*)"/g)) out[match[1]] = decodeXml(match[2]);
  return out;
}

function splitDomain(domain: string) {
  const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const parts = normalized.split(".");
  if (parts.length < 2) throw new Error("A registrable domain is required");
  return { domain: normalized, sld: parts.slice(0, -1).join("."), tld: parts.at(-1)! };
}

export class NamecheapClient {
  constructor(private readonly config: Config) {}

  private assertAllowed(domain: string) {
    const normalized = domain.toLowerCase();
    if (!this.config.allowedDomains.has(normalized)) {
      throw new Error(`Domain ${normalized} is not in NAMECHEAP_ALLOWED_DOMAINS`);
    }
  }

  private endpoint() {
    return this.config.sandbox
      ? "https://api.sandbox.namecheap.com/xml.response"
      : "https://api.namecheap.com/xml.response";
  }

  private async call(command: string, params: Record<string, string | number>) {
    const query = new URLSearchParams({
      ApiUser: this.config.apiUser,
      ApiKey: this.config.apiKey,
      UserName: this.config.username,
      ClientIp: this.config.clientIp,
      Command: command
    });
    for (const [key, value] of Object.entries(params)) query.set(key, String(value));
    const response = await fetch(`${this.endpoint()}?${query.toString()}`, { method: "GET" });
    const xml = await response.text();
    if (!response.ok) throw new Error(`Namecheap HTTP ${response.status}`);
    const status = xml.match(/<ApiResponse[^>]+Status="([^"]+)"/i)?.[1];
    if (status !== "OK") {
      const messages = [...xml.matchAll(/<Error[^>]*>([\s\S]*?)<\/Error>/gi)].map((m) => decodeXml(m[1].trim()));
      throw new Error(messages.join("; ") || "Namecheap API returned an error");
    }
    return xml;
  }

  async getHosts(domain: string): Promise<DnsRecord[]> {
    this.assertAllowed(domain);
    const { sld, tld } = splitDomain(domain);
    const xml = await this.call("namecheap.domains.dns.getHosts", { SLD: sld, TLD: tld });
    const records: DnsRecord[] = [];
    for (const match of xml.matchAll(/<host\s+[^>]*\/>/gi)) {
      const a = attrs(match[0]);
      records.push({
        host: a.Name,
        type: a.Type,
        address: a.Address,
        ttl: Number(a.TTL || 1800),
        mxPref: Number(a.MXPref || 10)
      });
    }
    return records;
  }

  private async backup(domain: string, records: DnsRecord[]) {
    const dir = path.resolve(process.cwd(), "backups");
    await mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(":", "-");
    const file = path.join(dir, `${domain}-${stamp}.json`);
    await writeFile(file, JSON.stringify({ domain, createdAt: new Date().toISOString(), records }, null, 2), "utf8");
    return file;
  }

  private async setHosts(domain: string, records: DnsRecord[]) {
    this.assertAllowed(domain);
    if (!records.length) throw new Error("Refusing to submit an empty DNS record set");
    if (records.length > 150) throw new Error("Refusing unusually large DNS change");
    const { sld, tld } = splitDomain(domain);
    const params: Record<string, string | number> = { SLD: sld, TLD: tld };
    records.forEach((record, index) => {
      const i = index + 1;
      params[`HostName${i}`] = record.host;
      params[`RecordType${i}`] = record.type;
      params[`Address${i}`] = record.address;
      params[`TTL${i}`] = record.ttl ?? 1800;
      if (record.type.toUpperCase() === "MX" || record.type.toUpperCase() === "MXE") params[`MXPref${i}`] = record.mxPref ?? 10;
    });
    await this.call("namecheap.domains.dns.setHosts", params);
  }

  async upsertHost(domain: string, next: DnsRecord) {
    const current = await this.getHosts(domain);
    const backupFile = await this.backup(domain, current);
    const host = next.host.trim();
    const type = next.type.trim().toUpperCase();
    const filtered = current.filter((r) => !(r.host.toLowerCase() === host.toLowerCase() && r.type.toUpperCase() === type));
    const updated = [...filtered, { ...next, host, type, ttl: next.ttl ?? 1800 }];
    await this.setHosts(domain, updated);
    return { backupFile, before: current, after: await this.getHosts(domain) };
  }

  async deleteHost(domain: string, host: string, type?: string) {
    const current = await this.getHosts(domain);
    const backupFile = await this.backup(domain, current);
    const updated = current.filter((r) => {
      if (r.host.toLowerCase() !== host.toLowerCase()) return true;
      return type ? r.type.toUpperCase() !== type.toUpperCase() : false;
    });
    if (updated.length === current.length) throw new Error("No matching DNS record found");
    await this.setHosts(domain, updated);
    return { backupFile, before: current, after: await this.getHosts(domain) };
  }
}

export async function detectPublicIpv4() {
  const response = await fetch("https://api.ipify.org?format=json");
  if (!response.ok) throw new Error("Unable to detect public IPv4");
  const data = await response.json() as { ip?: string };
  if (!data.ip || !/^\d{1,3}(\.\d{1,3}){3}$/.test(data.ip)) throw new Error("Public IPv4 lookup returned an invalid value");
  return data.ip;
}
