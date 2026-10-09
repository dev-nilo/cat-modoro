import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { validate } from "@readme/openapi-parser";
import { describe, expect, it } from "vitest";

import { openApiDocument } from "@/server/openapi";

const API_DIR = "src/app/api/v1";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/** Every (path, method) the route files actually export, e.g. `/api/v1/sessions/{id}` + `delete`. */
function implementedOperations(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "route.ts") {
        const segments = relative("src/app", dir).split(sep).map((s) => s.replace(/^\[(.+)\]$/, "{$1}"));
        const path = "/" + segments.join("/");
        if (path === "/api/v1/openapi.json") continue;
        const source = readFileSync(full, "utf8");
        for (const m of METHODS) if (new RegExp(`export (const|async function|function) ${m}\\b`).test(source)) out.push(`${m.toLowerCase()} ${path}`);
      }
    }
  };
  walk(API_DIR);
  return out.sort();
}

describe("OpenAPI document", () => {
  const doc = openApiDocument();

  it("is a valid OpenAPI 3.1 document", async () => {
    // The parser's types expect a fully typed OpenAPI object; ours is a plain literal.
    const result = await validate(structuredClone(doc) as unknown as Parameters<typeof validate>[0]);
    expect(result.valid ? [] : result.errors).toEqual([]);
  });

  it("documents exactly the operations the route files implement", () => {
    const documented = Object.entries(doc.paths)
      .flatMap(([path, item]) => Object.keys(item).filter((k) => k !== "parameters").map((m) => `${m} ${path}`))
      .sort();
    expect(documented).toEqual(implementedOperations());
  });

  it("references only schemas it defines", () => {
    const refs = [...JSON.stringify(doc).matchAll(/"\$ref":"#\/components\/schemas\/(\w+)"/g)].map((m) => m[1]);
    for (const name of new Set(refs)) expect(doc.components.schemas).toHaveProperty(name);
  });
});
