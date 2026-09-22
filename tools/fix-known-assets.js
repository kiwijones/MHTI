const fs = require("fs");

const replacements = new Map([
  ["files/templateArtifacts.js?1592463469", null],
  [
    "uploads/2/3/6/6/23664026/published/fb-flogo-blue-broadcast-2.png",
    "uploads/2/3/6/6/23664026/fb-flogo-blue-broadcast-2.png",
  ],
  [
    "uploads/2/3/6/6/23664026/editor/vmfir014.jpg",
    "uploads/2/3/6/6/23664026/vmfir014_orig.jpg",
  ],
  [
    "uploads/2/3/6/6/23664026/editor/vmfir016.jpg",
    "uploads/2/3/6/6/23664026/vmfir016_orig.jpg",
  ],
  [
    "uploads/2/3/6/6/23664026/published/cappagh-scrapbook-9-5.jpeg",
    "uploads/2/3/6/6/23664026/cappagh-scrapbook-9-5_orig.jpeg",
  ],
  [
    "uploads/2/3/6/6/23664026/published/screen-shot-2019-08-15-at-00-25-54.png",
    "uploads/2/3/6/6/23664026/screen-shot-2019-08-15-at-00-25-54_orig.png",
  ],
  [
    "uploads/2/3/6/6/23664026/published/screen-shot-2019-08-15-at-00-30-32.png",
    "uploads/2/3/6/6/23664026/screen-shot-2019-08-15-at-00-30-32_orig.png",
  ],
]);

let changedPages = 0;

for (const file of fs.readdirSync(".").filter((name) => name.endsWith(".html"))) {
  const before = fs.readFileSync(file, "utf8");
  let after = before;

  for (const [oldValue, newValue] of replacements) {
    if (newValue === null) {
      const escaped = oldValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      after = after.replace(
        new RegExp(`\\s*<script\\s+src=['\"]${escaped}['\"]><\\/script>`, "g"),
        "",
      );
    } else {
      after = after.replaceAll(oldValue, newValue);
    }
  }

  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    changedPages += 1;
  }
}

console.log(`Changed pages: ${changedPages}`);
