import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const line = (o: Record<string, unknown>) => JSON.stringify(o);

const GOOD = [
  line({ at: '2026-10-29T01:30:00+01:00', job: 'zeta/last', status: 'ok', owner: 'rook' }),
  line({ at: '2026-10-29T01:31:00+01:00', job: 'alpha/first', status: 'retry', owner: null, error: 'upstream 503' }),
  line({ at: '2026-10-29T01:35:00+01:00', job: 'alpha/first', status: 'ok', owner: null }),
  line({ at: '2026-10-29T02:00:00+01:00', job: 'mid/job', status: 'fail', owner: 'poorna', error: 'boom' }),
].join('\n');

const NIGHT_OK = '2026-10-29';
const NIGHT_MISSING = '2026-10-30';
const NIGHT_EMPTY = '2026-10-31';
const NIGHT_BAD = '2026-11-01';

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  process.env.LANE_MARKER = 'TEST-MARKER';
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  mkdirSync(runsDir, { recursive: true });
  writeFileSync(join(runsDir, `${NIGHT_OK}.jsonl`), `${GOOD}\n`);
  writeFileSync(join(runsDir, `${NIGHT_EMPTY}.jsonl`), '');
  writeFileSync(
    join(runsDir, `${NIGHT_BAD}.jsonl`),
    `${GOOD.split('\n')[0]}\nthis is not json\n${GOOD.split('\n')[3]}\n`,
  );
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

const html = async (night: string) => {
  const res = await app.request(`/digest/${night}`);
  return { res, text: await res.text() };
};
const json = async (night: string) => {
  const res = await app.request(`/api/digest/${night}`);
  return { res, body: (await res.json()) as Night };
};

describe('GET /digest/:night (HTML)', () => {
  it('200 with a row per job and the lane banner', async () => {
    const { res, text } = await html(NIGHT_OK);
    expect(res.status).toBe(200);
    expect(text).toContain(`digest · ${NIGHT_OK}`);
    for (const job of ['alpha/first', 'mid/job', 'zeta/last']) expect(text).toContain(job);
    expect(text).toContain('upstream 503');
    expect(text).toContain('TEST-MARKER');
  });

  it('renders a null owner as a dash', async () => {
    const { text } = await html(NIGHT_OK);
    const alphaRow = text.slice(text.indexOf('alpha/first'), text.indexOf('mid/job'));
    expect(alphaRow).toContain('<td>—</td>');
  });

  it('404 for a night with no file', async () => {
    const { res, text } = await html(NIGHT_MISSING);
    expect(res.status).toBe(404);
    expect(text).toContain('no run log for that night');
  });

  it('empty night: 200 and "nothing ran"', async () => {
    const { res, text } = await html(NIGHT_EMPTY);
    expect(res.status).toBe(200);
    expect(text).toContain('nothing ran');
  });

  it('bad line: 200, good rows kept, says a line could not be read', async () => {
    const { res, text } = await html(NIGHT_BAD);
    expect(res.status).toBe(200);
    expect(text).toContain('1 line could not be read.');
    expect(text).toContain('zeta/last');
    expect(text).toContain('mid/job');
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('200 with job rows, null owner kept as null', async () => {
    const { res, body } = await json(NIGHT_OK);
    expect(res.status).toBe(200);
    expect(body.night).toBe(NIGHT_OK);
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/first', 'mid/job', 'zeta/last']);
    expect(body.rows[0]?.owner).toBeNull();
    expect(body.rows[0]?.lastError).toBe('upstream 503');
  });

  it('job order equals the order jobs appear in the HTML', async () => {
    const { body } = await json(NIGHT_OK);
    const { text } = await html(NIGHT_OK);
    const positions = body.rows.map((r) => text.indexOf(r.job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('404 for a night with no file', async () => {
    const { res, body } = await json(NIGHT_MISSING);
    expect(res.status).toBe(404);
    expect(body).toHaveProperty('error');
  });

  it('empty night: 200 with rows []', async () => {
    const { res, body } = await json(NIGHT_EMPTY);
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
  });

  it('bad line: 200, good rows kept, badLines is 1', async () => {
    const { res, body } = await json(NIGHT_BAD);
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['mid/job', 'zeta/last']);
  });
});
