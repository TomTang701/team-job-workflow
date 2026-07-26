import { readFileSync } from "node:fs";

const manifestUrl = new URL("../package.json", import.meta.url);
const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"));
const directDependencies = {
  ...manifest.dependencies,
  ...manifest.devDependencies,
};
const exactVersionPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const floatingDependencies = Object.entries(directDependencies).filter(
  ([, version]) => !exactVersionPattern.test(version),
);

if (floatingDependencies.length > 0) {
  const details = floatingDependencies
    .map(([name, version]) => `${name}@${version}`)
    .join(", ");
  throw new Error(`Direct dependencies must use exact versions: ${details}`);
}

console.log(`Verified ${Object.keys(directDependencies).length} exact direct dependency versions.`);
