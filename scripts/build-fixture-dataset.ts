// Regenerates fixtures/dataset.json from the fixtures. Run with `pnpm fixtures` after changing one.

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildFixtureDataset } from './fixture-dataset';

const dataset = await buildFixtureDataset();
await writeFile(fileURLToPath(new URL('../fixtures/dataset.json', import.meta.url)), `${JSON.stringify(dataset, null, 1)}\n`);
console.log(`wrote fixtures/dataset.json (${dataset.releases.length} releases, ${dataset.periods.length} periods)`);
