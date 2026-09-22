const fs = require("fs");

const baseUrl = new URL(process.argv[2] ?? "http://127.0.0.1:8080/");
const pages = fs.readdirSync(".").filter((file) => file.endsWith(".html"));
const targets = new Map();

for (const page of pages) {
  const pageUrl = new URL(page, baseUrl);
  targets.set(pageUrl.href, { method: "GET", source: page });

  const html = fs.readFileSync(page, "utf8");
  for (const match of html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
    const reference = match[1]
      .replaceAll("&rsquo;", "’")
      .replaceAll("&amp;", "&");

    if (/^(?:https?:|\/\/|mailto:|tel:|javascript:|#|data:|$)/i.test(reference)) {
      continue;
    }

    const url = new URL(reference, pageUrl);
    url.hash = "";
    targets.set(url.href, { method: "HEAD", source: page });
  }
}

const entries = [...targets.entries()];
const failures = [];
let nextIndex = 0;

async function worker() {
  while (nextIndex < entries.length) {
    const [url, details] = entries[nextIndex++];

    try {
      const response = await fetch(url, {
        method: details.method,
        redirect: "follow",
      });

      if (!response.ok) {
        failures.push({ url, status: response.status, source: details.source });
      }
    } catch (error) {
      failures.push({ url, status: error.message, source: details.source });
    }
  }
}

async function main() {
  await Promise.all(Array.from({ length: 12 }, () => worker()));

  console.log(`Base URL: ${baseUrl.href}`);
  console.log(`HTML pages: ${pages.length}`);
  console.log(`Unique local URLs checked: ${entries.length}`);
  console.log(`Failures: ${failures.length}`);

  for (const failure of failures) {
    console.error(`${failure.status}  ${failure.url}  <-  ${failure.source}`);
  }

  process.exitCode = failures.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
