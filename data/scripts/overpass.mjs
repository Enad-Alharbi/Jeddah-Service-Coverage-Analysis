// Minimal Overpass client: one query at a time, retry with exponential backoff,
// and every response saved to data/raw/ with the fetch date (reproducibility + snapshot date).
import fs from 'node:fs/promises';
import path from 'node:path';
import { overpass, paths } from './config.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs an Overpass QL query (JSON output) and returns the parsed body.
 * @param {string} query Overpass QL (without the [out:json][timeout] header)
 * @param {string} rawName base file name for the raw dump, e.g. "inspect_admin_levels"
 */
export async function runOverpass(query, rawName) {
  const fullQuery = `[out:json][timeout:${overpass.queryTimeoutSec}];\n${query}`;

  for (let attempt = 0; attempt <= overpass.maxRetries; attempt++) {
    const res = await fetch(overpass.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': overpass.userAgent,
      },
      body: new URLSearchParams({ data: fullQuery }),
    });

    // 429 = rate limited, 504 = server busy: back off and retry.
    if (res.status === 429 || res.status >= 500) {
      const waitMs = 2 ** attempt * 15_000;
      console.warn(`Overpass ${res.status}, retry ${attempt + 1}/${overpass.maxRetries} in ${waitMs / 1000}s`);
      await sleep(waitMs);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Overpass error ${res.status}: ${(await res.text()).slice(0, 500)}`);
    }

    const body = await res.json();
    if (body.remark) console.warn(`Overpass remark: ${body.remark}`);
    await saveRaw(body, rawName);
    return body;
  }
  throw new Error('Overpass: retries exhausted');
}

async function saveRaw(body, rawName) {
  const date = new Date().toISOString().slice(0, 10);
  await fs.mkdir(paths.raw, { recursive: true });
  const file = path.join(paths.raw, `${rawName}_${date}.json`);
  await fs.writeFile(file, JSON.stringify(body));
  console.log(`saved ${path.relative(process.cwd(), file)} (osm_base ${body.osm3s?.timestamp_osm_base ?? '?'})`);
}
