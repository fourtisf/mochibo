import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findLinks, htmlToText, isPublicIp, readLinks, withLinks } from "./links";

let server: http.Server;
let base = "";
beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/page") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><head><title>Gm &amp; hi</title><script>alert(1)</script></head><body><h1>Token</h1><p>Supply is 1B.</p></body></html>");
    } else if (req.url === "/go") {
      res.writeHead(302, { Location: "/page" });
      res.end();
    } else {
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end("x");
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => server.close());

describe("links", () => {
  it("finds at most two links and trims punctuation", () => {
    expect(findLinks("Read https://a.com/x, then https://b.com/y. And https://c.com")).toEqual(["https://a.com/x", "https://b.com/y"]);
  });
  it("knows public from private addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.1.1", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "0.0.0.0"]) expect(isPublicIp(ip)).toBe(false);
    for (const ip of ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"]) expect(isPublicIp(ip)).toBe(true);
  });
  it("turns HTML into text without scripts", () => {
    const { title, text } = htmlToText("<title>A &amp; B</title><style>x{}</style><p>One</p><p>Two</p>");
    expect(title).toBe("A & B");
    expect(text).toBe("A & B\nOne\nTwo");
  });
  it("refuses local addresses by default", async () => {
    const [r] = await readLinks(`see ${base}/page`);
    expect(r.error).toBe("that address is not public");
  });
  it("reads a page and follows a redirect when allowed (tests only, any port)", async () => {
    const [r] = await readLinks(`see ${base}/go`, { allowPrivate: true });
    expect(r.title).toBe("Gm & hi");
    expect(r.text).toContain("Supply is 1B.");
    expect(r.text).not.toContain("alert");
    expect(withLinks("Summarize", [r])).toContain("Content of");
  });
  it("skips files that are not text, and X links", async () => {
    expect((await readLinks(`${base}/img`, { allowPrivate: true }))[0].error).toBe("not a text page");
    expect((await readLinks("https://x.com/a/status/1"))[0].error).toContain("paste the post text");
  });
});
