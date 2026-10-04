/*
 * Read the web pages linked in a task, so "summarize https://..." works. Up to 2 links, public
 * addresses only: every connection (and every redirect) is checked at connect time against private,
 * loopback and link-local ranges, so a task cannot make this server reach the VPS or its network.
 */
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

const MAX_LINKS = 2;
const MAX_BYTES = 1_000_000;
const MAX_TEXT = 6000;
const TIMEOUT_MS = 8000;

const blocked = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  blocked.addSubnet(net, bits, "ipv6");

export const isPublicIp = (raw: string): boolean => {
  let ip = raw.replace(/^\[|\]$/g, "");
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) is checked as the IPv4 address it carries.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) ip = mapped[1];
  const v = isIP(ip);
  return v !== 0 && !blocked.check(ip, v === 4 ? "ipv4" : "ipv6");
};

/** DNS lookup that refuses non-public addresses (runs at connect time, so DNS rebinding cannot slip through). */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = (addresses as unknown as LookupAddress[]).filter((a) => isPublicIp(a.address));
    if (!list.length) return callback(new Error("blocked address"), "", 4);
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

export interface LinkResult {
  url: string;
  title?: string;
  text?: string;
  error?: string;
}

export function findLinks(task: string): string[] {
  const urls = task.match(/https?:\/\/[^\s<>"'`)\]]+/gi) ?? [];
  return [...new Set(urls.map((u) => u.replace(/[.,;:!?]+$/, "")))].slice(0, MAX_LINKS);
}

function get(url: URL, allowPrivate: boolean, redirects = 3): Promise<{ body: Buffer; type: string; finalUrl: URL }> {
  return new Promise((resolve, reject) => {
    // A literal IP skips DNS (and so the lookup check): check it here, for every hop.
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (!allowPrivate && isIP(host) && !isPublicIp(host)) return reject(new Error("blocked address"));
    if (!allowPrivate && url.port && !["80", "443", "8080", "8443"].includes(url.port)) return reject(new Error("unsupported port"));
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.get(
      url,
      {
        lookup: allowPrivate ? undefined : safeLookup,
        timeout: TIMEOUT_MS,
        headers: { "User-Agent": "MochiboBot/1.0 (+https://mochibo.studio)", Accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.1" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirects <= 0) return reject(new Error("too many redirects"));
          const next = new URL(res.headers.location, url);
          if (next.protocol !== "http:" && next.protocol !== "https:") return reject(new Error("unsupported redirect"));
          return resolve(get(next, allowPrivate, redirects - 1));
        }
        if (status >= 400) {
          res.resume();
          return reject(new Error(`HTTP ${status}`));
        }
        const type = String(res.headers["content-type"] ?? "");
        if (!/text\/|application\/(json|xhtml|xml)/i.test(type)) {
          res.resume();
          return reject(new Error("not a text page"));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            req.destroy();
            resolve({ body: Buffer.concat(chunks), type, finalUrl: url });
          } else chunks.push(c);
        });
        res.on("end", () => resolve({ body: Buffer.concat(chunks), type, finalUrl: url }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
  });
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function htmlToText(html: string): { title?: string; text: string } {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const text = html
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/title)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title: title ? htmlToText(title).text.slice(0, 160) : undefined, text };
}

/** Fetch and extract the links in a task. Never throws: failures come back as `error`. */
export async function readLinks(task: string, opts: { allowPrivate?: boolean } = {}): Promise<LinkResult[]> {
  return Promise.all(
    findLinks(task).map(async (raw): Promise<LinkResult> => {
      let url: URL;
      try {
        url = new URL(raw);
      } catch {
        return { url: raw, error: "not a valid link" };
      }
      if (/(^|\.)(x|twitter)\.com$/i.test(url.hostname)) return { url: raw, error: "X posts need a login, so paste the post text instead" };
      try {
        const { body, type } = await get(url, Boolean(opts.allowPrivate));
        const raw_ = body.toString("utf8");
        const { title, text } = /html|xml/i.test(type) ? htmlToText(raw_) : { title: undefined, text: raw_.trim() };
        if (!text) return { url: raw, error: "the page has no readable text" };
        return { url: raw, title, text: text.slice(0, MAX_TEXT) };
      } catch (e) {
        const msg = (e as Error).message;
        return { url: raw, error: msg === "blocked address" ? "that address is not public" : msg.slice(0, 80) };
      }
    }),
  );
}

/** The user message the AI sees: the task, then what each link contains (or why it could not be read). */
export function withLinks(task: string, links: LinkResult[]): string {
  if (!links.length) return task;
  const parts = links.map((l) =>
    l.text
      ? `Content of ${l.url}${l.title ? ` (${l.title})` : ""}:\n${l.text}`
      : `Could not open ${l.url}: ${l.error}. Say so briefly if it matters for the answer.`,
  );
  return `${task}\n\n---\n${parts.join("\n\n---\n")}`;
}
