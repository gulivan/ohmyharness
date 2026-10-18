import { displayPath, loadTools } from "../src/data/load";

const dirFlag = process.argv.indexOf("--dir");
const override =
  dirFlag !== -1 ? process.argv[dirFlag + 1] : process.env.OMH_DATA_DIR;

const result = loadTools({ dir: override, throwOnError: false });
const relative = displayPath(result.dir);

if (result.issues.length > 0) {
  console.error(
    `\n✗ ${result.issues.length} invalid tool file(s) in ${relative}:\n`,
  );
  for (const issue of result.issues) {
    console.error(`  ${issue.file}`);
    for (const message of issue.messages) {
      console.error(`    → ${message}`);
    }
  }
  console.error("\nEvery file must match src/data/schema.ts. See CONTRIBUTING.md.\n");
  process.exit(1);
}

if (result.tools.length === 0) {
  console.warn(`⚠ No tool files in ${relative}. The site will render an empty directory.`);
} else {
  const files = result.tools.length === 1 ? "file" : "files";
  console.log(`✓ ${result.tools.length} tool ${files} valid in ${relative}.`);
}
