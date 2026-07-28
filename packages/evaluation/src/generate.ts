import { mkdir, writeFile } from "node:fs/promises";

import { buildReferenceDataset } from "./dataset";

const outputUrl = new URL(
  "../../../evaluation/reference-v1.json",
  import.meta.url,
);
await mkdir(new URL(".", outputUrl), { recursive: true });
await writeFile(
  outputUrl,
  `${JSON.stringify(buildReferenceDataset(), null, 2)}\n`,
  "utf8",
);
