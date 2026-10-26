// action.yml is read by the Actions runner, not by our code, so a YAML slip in it only shows up when a workflow
// loads the action. Parse it here, with every input and output described.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

describe('action.yml', () => {
  it('parses, with a description on every input and output', async () => {
    const manifest = parse(await readFile(join(__dirname, '../../../action.yml'), 'utf8'), { strict: true });
    for (const section of ['inputs', 'outputs']) {
      for (const [name, spec] of Object.entries(manifest[section] as Record<string, { description?: unknown }>)) {
        expect(typeof spec.description, `${section}.${name}.description`).toBe('string');
      }
    }
    expect(manifest.runs.main).toBe('dist/index.js');
  });
});
