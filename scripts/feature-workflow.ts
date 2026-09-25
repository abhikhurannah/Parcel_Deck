import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DEFAULT_POLICY } from '../server/domain.js';
const root = resolve('.'),
  work = mkdtempSync(join(tmpdir(), 'parceldesk-ts-feature-')),
  transcript: string[] = [];
function run(command: string, ...args: string[]) {
  const out = execFileSync(command, args, {
    cwd: work,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  transcript.push('$ ' + [command, ...args].join(' ') + '\n' + out);
  return out;
}
try {
  for (const name of ['server', 'shared', 'tests', 'examples']) mkdirSync(join(work, name));
  for (const path of ['server/domain.ts', 'shared/types.ts', 'tests/domain.test.ts'])
    copyFileSync(join(root, path), join(work, path));
  symlinkSync(join(root, 'node_modules'), join(work, 'node_modules'), 'dir');
  writeFileSync(join(work, 'package.json'), '{"type":"module"}\n');
  writeFileSync(join(work, '.gitignore'), 'node_modules/\n');
  run('git', 'init', '-b', 'main');
  run('git', 'config', 'user.name', 'ParcelDesk workflow example');
  run('git', 'config', 'user.email', 'workflow@example.invalid');
  run('git', 'add', '.');
  run('git', 'commit', '-m', 'Baseline TypeScript routing and regression tests');
  run('git', 'switch', '-c', 'feature/bulky-department');
  const policy = structuredClone(DEFAULT_POLICY);
  policy.bands.splice(2, 0, { max_kg: '30', department: 'Bulky' });
  writeFileSync(join(work, 'examples/bulky-policy.json'), JSON.stringify(policy, null, 2) + '\n');
  writeFileSync(
    join(work, 'tests/bulky-feature.test.ts'),
    `import {test} from 'node:test';\nimport assert from 'node:assert/strict';\nimport {readFileSync} from 'node:fs';\nimport {validatePolicy,validateParcel,route} from '../server/domain.js';\nfor(const [weight,target] of [['10','Regular'],['10.001','Bulky'],['30','Bulky'],['30.001','Heavy']])test('Bulky boundary '+weight,()=>{const policy=validatePolicy(JSON.parse(readFileSync('examples/bulky-policy.json','utf8')));const decision=route(validateParcel({weight,value:'1000.01',country:'NL'}),policy);assert.equal(decision.department,target);assert.equal(decision.status,'pending_insurance');});\n`,
  );
  run(
    process.execPath,
    '--import',
    'tsx',
    '--test',
    'tests/domain.test.ts',
    'tests/bulky-feature.test.ts',
  );
  run('git', 'add', '.');
  run('git', 'commit', '-m', 'Add Bulky fixture and insurance boundary tests');
  run('git', 'diff', 'main...HEAD', '--stat');
  run('git', 'switch', 'main');
  run(
    'git',
    'merge',
    '--no-ff',
    'feature/bulky-department',
    '-m',
    'Merge Bulky configuration example',
  );
  run(
    process.execPath,
    '--import',
    'tsx',
    '--test',
    'tests/domain.test.ts',
    'tests/bulky-feature.test.ts',
  );
  run('git', 'log', '--graph', '--oneline', '--all');
  run('git', 'bundle', 'create', join(root, 'docs/feature-workflow.bundle'), '--all');
  writeFileSync(join(root, 'docs/feature-workflow-transcript.txt'), transcript.join('\n'));
  console.log('Actual TypeScript branch, tests, merge, transcript and Git bundle created.');
} finally {
  rmSync(work, { recursive: true, force: true });
}
