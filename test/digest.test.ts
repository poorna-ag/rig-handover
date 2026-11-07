import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseNight, readNight } from '../src/digest/read.js';

// runs/ is read-only: only read from it. Everything else goes to a temp dir.
const tmp = mkdtempSync(join(tmpdir(), 'rig-digest-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  if (!night) throw new Error('runs/2026-10-28.jsonl not found');
  const row = (job: string) => {
    const r = night.rows.find((x) => x.job === job);
    if (!r) throw new Error(`no row for ${job}`);
    return r;
  };

  it('has 5 jobs, sorted by job, and 1 bad line (the truncated last line)', () => {
    expect(night.night).toBe('2026-10-28');
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night.badLines).toBe(1);
  });

  it('keeps the null-owner row', () => {
    expect(row('digest/render')).toEqual({
      job: 'digest/render',
      owner: null,
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T05:41:09+01:00',
      lastAt: '2026-10-29T05:41:09+01:00',
    });
  });

  it('counts retries: fixtures/refresh 3, lane/sync 1', () => {
    expect(row('fixtures/refresh')).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(row('lane/sync')).toMatchObject({
      owner: 'rook',
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'lock held',
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });

  it('shows notes/backup failed, with its error', () => {
    expect(row('notes/backup')).toMatchObject({
      owner: 'lane-07',
      runs: 1,
      retries: 0,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
  });

  it('counts valid lines per status for the board', () => {
    expect(night.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    const runs = night.rows.reduce((n, r) => n + r.runs, 0);
    expect(night.counts.ok + night.counts.retry + night.counts.fail).toBe(runs);
  });
});

describe('readNight edge cases', () => {
  it('returns null for a night with no file', () => {
    expect(readNight(tmp, '2026-01-01')).toBeNull();
    expect(readNight(join(tmp, 'missing-dir'), '2026-01-01')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    expect(readNight('runs', '../runs/2026-10-28')).toBeNull();
    expect(readNight('runs', '2026-10-28.jsonl')).toBeNull();
  });

  it('reads an empty file as a night where nothing ran', () => {
    writeFileSync(join(tmp, '2026-02-01.jsonl'), '');
    expect(readNight(tmp, '2026-02-01')).toEqual({
      night: '2026-02-01',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('counts invalid lines and skips blank ones, never throws', () => {
    const lines = [
      '{"at":"2026-02-02T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
      '',
      '   ',
      'not json',
      '[]',
      '"a string"',
      '{"at":"2026-02-02T01:00:00+01:00","job":"a","status":"done","owner":"x"}', // bad status
      '{"at":"2026-02-02T01:00:00","job":"a","status":"ok","owner":"x"}', // no offset
      '{"at":"yesterday","job":"a","status":"ok","owner":"x"}',
      '{"job":"a","status":"ok","owner":"x"}', // no at
      '{"at":"2026-02-02T01:00:00+01:00","job":"","status":"ok","owner":"x"}', // empty job
      '{"at":"2026-02-02T01:00:00+01:00","job":"a","status":"ok"}', // no owner
      '{"at":"2026-02-02T01:00:00+01:00","job":"a","status":"ok","owner":7}',
      '{"at":"2026-02-02T01:00:00+01:00","job":"a","status":"fail","owner":"x","error":{"m":1}}',
      '{"at":"2026-02-02T02:00:00+01:00","job":"a","status":"fail","owner":"y","error":null}',
    ];
    const night = parseNight('2026-02-02', lines.join('\n') + '\n');
    expect(night.badLines).toBe(11);
    expect(night.rows).toEqual([
      {
        job: 'a',
        owner: 'y',
        runs: 2,
        retries: 0,
        lastStatus: 'fail',
        lastError: null,
        firstAt: '2026-02-02T01:00:00+01:00',
        lastAt: '2026-02-02T02:00:00+01:00',
      },
    ]);
    expect(night.counts).toEqual({ ok: 1, retry: 0, fail: 1 });
  });

  it('keeps each line\'s own offset and takes the owner from the last line', () => {
    const text = [
      '{"at":"2026-03-28T23:30:00+01:00","job":"b","status":"retry","owner":"x","error":"e1"}',
      '{"at":"2026-03-29T03:10:00+02:00","job":"b","status":"retry","owner":null,"error":"e2"}',
      '{"at":"2026-03-29T03:20:00+02:00","job":"b","status":"ok","owner":null}',
    ].join('\n');
    const [row] = parseNight('2026-03-28', text).rows;
    expect(row).toMatchObject({
      owner: null,
      runs: 3,
      retries: 2,
      lastStatus: 'ok',
      lastError: 'e2',
      firstAt: '2026-03-28T23:30:00+01:00',
      lastAt: '2026-03-29T03:20:00+02:00',
    });
  });
});
