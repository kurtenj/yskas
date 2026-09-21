// Bundles real UI components with in-memory service adapters. Never connects to Convex.
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
const mock = resolve("tests/browser/services.tsx");
const result = await build({
  entryPoints: ["tests/browser/entry.tsx"],
  bundle: true,
  write: false,
  jsx: "automatic",
  format: "esm",
  define: {
    "process.env.NODE_ENV": '"development"',
    "process.env.NEXT_PUBLIC_APP_VERSION": '"test"',
  },
  plugins: [
    {
      name: "test-services",
      setup(builder) {
        builder.onResolve(
          {
            filter:
              /^(convex\/react|next\/navigation|next\/link|@\/lib\/user-context)$/,
          },
          () => ({ path: mock }),
        );
      },
    },
  ],
});
const css = await postcss([tailwind()]).process(
  await readFile("app/globals.css", "utf8"),
  { from: resolve("app/globals.css") },
);
createServer((req, res) => {
  if (req.url === "/api/meal-events") {
    res.writeHead(204); res.end();
  } else if (req.url === "/bundle.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(result.outputFiles[0].text);
  } else if (req.url === "/style.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(css.css);
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="bg-mist-950 text-mist-50"><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>',
    );
  }
}).listen(4173, "127.0.0.1");
