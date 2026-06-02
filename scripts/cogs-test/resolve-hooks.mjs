import { pathToFileURL } from "node:url";
const root = process.cwd().replace(/\\/g, "/");
export async function resolve(spec, ctx, next) {
  if (spec === "@/generated/prisma") {
    return { url: pathToFileURL(root + "/generated/prisma/index.js").href, shortCircuit: true };
  }
  if (spec.startsWith("@/")) {
    return { url: pathToFileURL(root + "/" + spec.slice(2)).href, shortCircuit: true };
  }
  return next(spec, ctx);
}
