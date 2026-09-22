const fs = require("fs");

const pages = fs.readdirSync(".").filter((file) => file.endsWith(".html"));
const missing = [];

for (const page of pages) {
  const html = fs.readFileSync(page, "utf8");

  for (const match of html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
    const reference = match[1];

    if (/^(?:https?:|\/\/|mailto:|tel:|javascript:|#|data:|$)/i.test(reference)) {
      continue;
    }

    let target = reference
      .split(/[?#]/)[0]
      .replace(/^\//, "")
      .replaceAll("&rsquo;", "’")
      .replaceAll("&amp;", "&");

    try {
      target = decodeURIComponent(target);
    } catch {
      // Preserve malformed legacy URLs exactly as exported.
    }

    if (!fs.existsSync(target)) {
      missing.push({ page, reference, target });
    }
  }
}

const grouped = new Map();

for (const item of missing) {
  const group = grouped.get(item.target) ?? {
    target: item.target,
    count: 0,
    pages: [],
  };

  group.count += 1;
  group.pages.push(item.page);
  grouped.set(item.target, group);
}

const results = [...grouped.values()].sort(
  (left, right) => right.count - left.count || left.target.localeCompare(right.target),
);

console.log(`Scanned pages: ${pages.length}`);
console.log(`Missing occurrences: ${missing.length}`);
console.log(`Unique missing targets: ${results.length}`);

for (const result of results) {
  console.log(
    `${String(result.count).padStart(3)}  ${result.target}  <-  ${result.pages.slice(0, 4).join(", ")}`,
  );
}

process.exitCode = missing.length === 0 ? 0 : 1;
