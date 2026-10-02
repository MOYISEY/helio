import {mkdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const directory = 'qa-private/numerical-reference';
mkdirSync(directory, {recursive: true});
const results = [];
for (const name of ['fixtures.json', 'fetch-truth.js', 'accuracy.test.js']) {
  const url = `https://raw.githubusercontent.com/mourner/suncalc/v2.1.0/test/${name}`;
  try {
    const response = await fetch(url, {signal: AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    writeFileSync(`${directory}/${name}`, bytes);
    results.push({name, url, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')});
  } catch (error) { results.push({name, url, error: error.message}); }
}
writeFileSync(`${directory}/provenance.json`, JSON.stringify({retrievedAt: new Date().toISOString(), results}, null, 2));
console.log(JSON.stringify(results, null, 2));
