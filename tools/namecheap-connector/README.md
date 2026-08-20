# Hassoun Namecheap Connector

Secure local MCP bridge for managing Namecheap DNS without exposing the Namecheap API key to ChatGPT or GitHub.

## Current scope

By default, the connector can operate only on `hassoun.app`.

Tools exposed:

- `namecheap_connection_info` — returns the connector's detected public IPv4 and allowed domains.
- `namecheap_get_dns` — reads all Namecheap DNS host records.
- `namecheap_upsert_dns` — adds/replaces a DNS host record while preserving all unrelated records.
- `namecheap_delete_dns` — deletes matching DNS host records while preserving unrelated records.

All DNS writes first save the current full record set under `backups/`.

## Why it runs locally

Namecheap requires API requests to originate from a whitelisted IPv4 address. A local connector uses the Windows PC's public IPv4, avoiding paid static-egress hosting. If your ISP changes the public IP, update Namecheap's whitelist before using the connector again.

## Setup on Windows

1. Download/clone the WOPT repository and switch to branch `work/hassoun-1.0-store-admin`.
2. Open `tools/namecheap-connector`.
3. Run `start-windows.ps1`.
4. On first run it creates `.env` and opens it in Notepad.
5. Fill in:
   - `NAMECHEAP_API_USER`
   - `NAMECHEAP_API_KEY`
   - `NAMECHEAP_USERNAME`
   - `CONNECTOR_BEARER_TOKEN` (make this a long random secret)
6. Optional: add `NAMECHEAP_ALLOWED_DOMAINS=hassoun.app` explicitly.
7. Run `start-windows.ps1` again.
8. The console prints `Namecheap ClientIp / whitelist IPv4: x.x.x.x`.
9. In Namecheap go to Profile → Tools → API Access → Whitelisted IPs and add that exact IPv4.
10. Restart the connector after whitelisting.

Never paste the Namecheap API key into chat. Never commit `.env` or `backups/`.

## MCP endpoint

The local MCP endpoint is:

`http://127.0.0.1:8788/mcp`

It requires:

`Authorization: Bearer <CONNECTOR_BEARER_TOKEN>`

For a remote ChatGPT custom connector, expose this local endpoint through an HTTPS tunnel and keep the bearer token configured on the connector side. The Namecheap API call still exits from the local Windows PC, so Namecheap continues to see the whitelisted home/public IPv4.

## Namecheap safety note

Namecheap `setHosts` replaces the domain's host record set. This connector therefore always reads the complete DNS set first, creates a local backup, preserves unrelated records, modifies only the requested record(s), then submits the complete updated set.

## Domain for the Hassoun CRM

The intended CRM hostname is:

`admin.hassoun.app`

Once the CRM deployment target is finalized, use `namecheap_upsert_dns` to create the required CNAME/A record without touching other `hassoun.app` records.
