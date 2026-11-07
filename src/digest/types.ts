// Plan morning-digest § 1: the contract between the run log reader and everything that shows
// it (the digest page, the JSON route, the status board link). Types only; the reader itself
// is `readNight` in `src/digest/read.ts`, typed by `ReadNight` below.
//
// Input: `runs/<night>.jsonl`, one JSON object per line:
//   { "at": "2026-10-29T01:30:00+01:00", "job": "fixtures/refresh", "status": "retry",
//     "owner": "rook", "error": "upstream 503" }
// `at`, `job`, `status` and `owner` are required (`owner` may be null); `error` is optional.

export type RunStatus = 'ok' | 'retry' | 'fail';

/** One job's night. Plain data: the JSON route serialises it as is. */
export type DigestRow = {
  job: string;
  /** Owner on the job's last line. `null` stays `null` here; views show it as `—`. */
  owner: string | null;
  /** Number of valid lines for this job (every attempt counts, retries included). */
  runs: number;
  /** Number of valid lines for this job with status `retry`. */
  retries: number;
  /** Status of the job's last line. */
  lastStatus: RunStatus;
  /**
   * `error` of the job's most recent line that has one, even if a later line succeeded
   * (so a job that retried and then went `ok` still says why it retried). `null` if no line
   * of the job carried an error.
   */
  lastError: string | null;
  /** `at` of the job's first line, exactly as written in the log (offset kept, never UTC). */
  firstAt: string;
  /** `at` of the job's last line, exactly as written in the log (offset kept, never UTC). */
  lastAt: string;
};

/** Number of valid lines per status. The board shows these beside each night. */
export type StatusCounts = { ok: number; retry: number; fail: number };

/** A night whose file exists. An empty file is a `Night` with `rows: []` ("nothing ran"). */
export type Night = {
  /** `YYYY-MM-DD`, the file name without `.jsonl`. */
  night: string;
  /** One row per job, sorted by `job` (plain code-unit order). */
  rows: DigestRow[];
  /**
   * Lines that were not valid: bad JSON, not an object, or a missing/invalid required field.
   * Counted, never thrown, never in `rows` or `counts`. Blank lines are not counted.
   */
  badLines: number;
  /** Valid lines per status across all jobs; the three add up to the sum of `rows[].runs`. */
  counts: StatusCounts;
};

/**
 * Reads `<runsDir>/<night>.jsonl`. Synchronous, never writes.
 *
 * Returns `null` when there is no such file, or when `night` is not `YYYY-MM-DD` (so a route can
 * pass its param straight through and answer 404 on `null`). Otherwise returns the `Night`,
 * including for an empty file. Only an unreadable existing file (permissions, a directory) throws.
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;
