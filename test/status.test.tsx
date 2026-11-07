import { mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
  });

  it('links each night to its digest with counts', async () => {
    const html = await (await createApp(config).request('/')).text();
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a>');
    expect(html).toMatch(/2026-10-28<\/a>\s*ok 10 · retry 4 · fail 1/);
    expect(html).toMatch(/<a href="\/digest\/(\d{4}-\d{2}-\d{2})">/g);
    const nights = readdirSync('runs').filter((f) => f.endsWith('.jsonl')).map((f) => f.slice(0, 10));
    expect(nights.length).toBe(2);
    for (const n of nights) expect(html).toContain(`<a href="/digest/${n}">`);
  });

  it('shows — when a night cannot be read', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-'));
    mkdirSync(join(dir, '2026-01-01.jsonl'));
    const html = await (await createApp({ ...config, runsDir: dir }).request('/')).text();
    expect(html).toContain('<a href="/digest/2026-01-01">2026-01-01</a>');
    expect(html).toContain('—');
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
