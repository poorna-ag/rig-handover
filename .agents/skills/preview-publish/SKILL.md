---
name: preview-publish
description: Save a rig page as one HTML file and put it on Netlify as a public preview, check it like a stranger, then take the lane marker off after the review. Use for a plan's "Preview for review" and "Clean up" steps (ADR 0003).
---

# preview-publish

A preview is one self-contained HTML file of a rig page on a public HTTPS link we can upload over
(ADR 0003). This lane uses Netlify, through its CLI.

## Before you start

- Ask the human before every upload: say what goes up, where, who can see it and how to undo it.
- The Netlify CLI runs with `npx -y netlify-cli@latest`. If `netlify status` says "Not logged
  in", run `netlify login`: it opens a browser where the human signs in and clicks Authorize.
  Never ask for a token.
- The site for this repo is `rig-handover-jayanie-mega` →
  https://rig-handover-jayanie-mega.netlify.app. Look up its Project ID with
  `netlify sites:list`; for a new site, `netlify sites:create --name <name> --disable-linking`
  (keep the lane marker out of the name: the name is part of the link and can't be uploaded over).

## Save the page (a command, not "save as")

Keep the file outside the repo (never commit previews, AGENTS.md). With the marker for review:

```sh
PORT=8797 LANE_MARKER=<marker> node --import tsx src/server.ts &   # note the PID
curl -s -o <out-dir>/index.html localhost:8797/digest/<night>
kill <PID>
```

`LANE_MARKER` can come from `.env` or, as here, from the one process that saves the page.
Check the file: the banner shows the marker, and there is no `<script>`, `<link>` or outside URL.

## Upload and check like a stranger

```sh
npx -y netlify-cli@latest deploy --dir <out-dir> --prod --no-build --site <project-id>
curl -s -w '\n%{http_code}\n' https://<site>.netlify.app/ | grep -E 'class="marker"|^[0-9]{3}$'
```

A 401 with a "Login Redirect" page means Netlify site protection is on: the reviewer can't open
it. The human turns it off in Netlify → Project configuration → Access & security → Visitor
access. Send the link only once a fetch from outside returns 200 with the page.

## After the review: take the marker off

Only once the reviewer has looked (the preview issue stays open until then):

```sh
env -u LANE_MARKER PORT=8798 node --import tsx src/server.ts &   # no .env with a marker either
curl -s -o <clean-dir>/index.html localhost:8798/digest/<night>
kill <PID>
npx -y netlify-cli@latest deploy --dir <clean-dir> --prod --no-build --site <project-id>
```

Check that the public link's banner reads "no marker set". Netlify keeps every deploy at its own
unique link, so the first deploy's link still shows the marker: tell the human, who can delete
that deploy, or the site once the plan is done.
