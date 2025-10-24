// supabase/functions/safe-fetch/index.ts
// deno deploy: supabase functions deploy safe-fetch
const ALLOWED_HOSTS = new Set([
  "example.com",
  "api.example.com",
  // add your allowed domains here
]);

// if you truly must allow many domains, keep this block list too
const BLOCKED_CIDRS = [
  // RFC1918 + localhost + link-local + metadata
  "127.0.0.0/8",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "169.254.0.0/16",
  "0.0.0.0/8",
  "::1/128",
  "fc00::/7",
  "fe80::/10",
];

function ipToBigInt(ip: string) {
  // naive converter; use a lib if you prefer
  if (ip.includes(":")) { // IPv6
    const parts = ip.split(":").map(p => parseInt(p || "0", 16));
    let v = 0n;
    for (const p of parts) v = (v << 16n) + BigInt(p);
    return { v, ver: 6 as const };
  } else { // IPv4
    return {
      v: BigInt(ip.split(".").reduce((a, b) => (a << 8) + Number(b), 0)),
      ver: 4 as const
    };
  }
}
function parseCIDR(cidr: string) {
  const [net, m] = cidr.split("/");
  const maskBits = Number(m);
  const { v, ver } = ipToBigInt(net);
  const bits = ver === 4 ? 32n : 128n;
  const mask = ((1n << bits) - 1n) << (bits - BigInt(maskBits));
  return { net: v & mask, mask, ver };
}
const BLOCKS = BLOCKED_CIDRS.map(parseCIDR);

function isBlockedIP(ip: string) {
  const { v, ver } = ipToBigInt(ip);
  for (const b of BLOCKS) {
    if (b.ver !== ver) continue;
    if ((v & b.mask) === b.net) return true;
  }
  // Special-case major cloud metadata hostnames/IPs
  if (ip === "169.254.169.254") return true; // AWS/GCP/Azure metadata
  return false;
}

Deno.serve(async (req) => {
  try {
    const { url } = await req.json().catch(() => ({}));
    if (!url) return new Response(JSON.stringify({ error: "url required" }), { status: 400 });

    const u = new URL(url);

    // 1) Require HTTPS (prevents Host header shenanigans + cert mismatch games)
    if (u.protocol !== "https:") {
      return new Response(JSON.stringify({ error: "only https allowed" }), { status: 400 });
    }

    // 2) Allowlists win. If you can, lock to a curated set.
    if (ALLOWED_HOSTS.size && !ALLOWED_HOSTS.has(u.hostname)) {
      return new Response(JSON.stringify({ error: "host not allowed" }), { status: 403 });
    }

    // 3) DNS resolve the host and block private/loopback/metadata IPs
    const addrs = [
      ...(await Deno.resolveDns(u.hostname, "A").catch(() => [] as string[])),
      ...(await Deno.resolveDns(u.hostname, "AAAA").catch(() => [] as string[])),
    ];
    if (addrs.length === 0) {
      return new Response(JSON.stringify({ error: "host could not be resolved" }), { status: 400 });
    }
    if (addrs.some(isBlockedIP)) {
      return new Response(JSON.stringify({ error: "resolved to a blocked IP range" }), { status: 403 });
    }

    // 4) Safe fetch options
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 5000); // 5s timeout
    const resp = await fetch(u.toString(), {
      method: "GET",
      redirect: "manual",     // don't follow redirects (could hop to internal IP)
      signal: ac.signal,
      headers: {
        // do NOT forward your Authorization/cookies; set a minimal UA
        "User-Agent": "WISDMScanBot/1.0",
        "Accept": "text/html,application/json;q=0.9,*/*;q=0.1",
      },
    }).finally(() => clearTimeout(timeout));

    // 5) Enforce content-type allowlist if you only expect JSON, etc.
    const ctype = resp.headers.get("content-type") || "";
    if (!/(^application\/json)|(^text\/html)/i.test(ctype)) {
      return new Response(JSON.stringify({ error: "content-type not allowed" }), { status: 415 });
    }

    // 6) Limit body size to prevent memory bombs
    const reader = resp.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    const MAX = 1_000_000; // 1 MB
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value!.byteLength;
        if (total > MAX) return new Response(JSON.stringify({ error: "response too large" }), { status: 413 });
        chunks.push(value!);
      }
    }
    const body = new TextDecoder().decode(chunks.length ? concat(chunks) : new Uint8Array());
    return new Response(JSON.stringify({ status: resp.status, headers: Object.fromEntries(resp.headers), body }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
});

function concat(parts: Uint8Array[]) {
  const size = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(size);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.byteLength; }
  return out;
}
