// Per-module coverage gate for the boards and cards features (T-55 / KAN-66). Runs after
// `vitest --coverage` (which writes coverage/coverage-summary.json and enforces the repo-wide line
// threshold in vitest.config.ts) and prints a table, so the figures are visible in the CI log.
//
// Why a script and not `thresholds['src/features/boards/**']`: in Vitest 1.x a glob threshold removes
// the matched files from the global figure, which would drop the rest of the repo below its own bar.
import { readFileSync } from 'node:fs';

const MODULES = [
  { name: 'src/features/boards', re: /src[\\/]features[\\/]boards[\\/]/, lines: 95, branches: 90 },
  { name: 'src/features/cards', re: /src[\\/]features[\\/]cards[\\/]/, lines: 95, branches: 85 },
];

const summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
const pct = (covered, total) => (total === 0 ? 100 : Math.round((covered / total) * 10000) / 100);

let failed = false;
console.log('| Module | Lines | Branches | Gate (lines / branches) | Result |');
console.log('| --- | --- | --- | --- | --- |');
for (const { name, re, lines, branches } of MODULES) {
  const files = Object.entries(summary).filter(([file]) => file !== 'total' && re.test(file));
  if (files.length === 0) {
    console.error(`check-module-coverage: no files for ${name} in coverage/coverage-summary.json`);
    process.exit(1);
  }
  const sum = (metric, key) => files.reduce((n, [, value]) => n + value[metric][key], 0);
  const linePct = pct(sum('lines', 'covered'), sum('lines', 'total'));
  const branchPct = pct(sum('branches', 'covered'), sum('branches', 'total'));
  const ok = linePct >= lines && branchPct >= branches;
  failed ||= !ok;
  console.log(
    `| ${name} (${files.length} files) | ${linePct} % | ${branchPct} % | ${lines} % / ${branches} % | ${ok ? 'ok' : 'FAIL'} |`
  );
}
console.log(
  `| whole repository | ${summary.total.lines.pct} % | ${summary.total.branches.pct} % | see vitest.config.ts | - |`
);
if (failed) {
  console.error('check-module-coverage: a module is below its coverage gate');
  process.exit(1);
}
