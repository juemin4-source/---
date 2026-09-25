// Minimal Node loader hook: lets `node scripts/*.mjs` import the prototype's .ts modules
// by stripping type annotations, so headless tools reuse the exact same game code.
import fs from "node:fs";
import ts from "typescript";

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parent = context.parentURL ? new URL(context.parentURL) : new URL("file://" + process.cwd() + "/");
    const url = new URL(specifier, parent);
    // Game source uses bundler-style extensionless imports; Node needs the real file.
    if (!/\.[a-z]+$/i.test(url.pathname)) {
      for (const ext of [".ts", "/index.ts"]) {
        const candidate = new URL(url.href + ext);
        if (fs.existsSync(candidate)) return next(candidate.href, context);
      }
    }
    return next(url.href, context);
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith(".ts")) {
    const source = fs.readFileSync(new URL(url), "utf8");
    const js = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        isolatedModules: true,
      },
      fileName: url,
    }).outputText;
    return { format: "module", source: js, shortCircuit: true };
  }
  return next(url, context);
}
