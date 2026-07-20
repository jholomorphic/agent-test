import { runAllEvals } from "../apps/desktop/src/lib/evals";

async function main() {
  const results = await runAllEvals();
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name} — ${r.detail}`);
  }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length} / ${results.length} PASS`);
  if (failed.length) process.exit(1);
}

main();
