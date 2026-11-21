# RiverLens community edition

A community feed for visual waterway observations. People sign up, share a photo, support and comment on others' posts.
An AI model drafts a description of what is visible; reviewers confirm, correct or reject it.
Visual observations only: no water-chemistry, no safety judgements, no source attribution.

## Who can do what
| | Visitor | User | Reviewer |
|---|---|---|---|
| Read the feed | yes | yes | yes |
| Post, support, comment, reply | no | yes | yes |
| Delete posts / comments | no | own only | any |
| Confirm / correct / reject AI findings | no | no | yes |

## Files (everything must sit at the TOP LEVEL of the repository)
    api/  lib/  public/  package.json  vercel.json  README.md  dev-server.js

## Vercel environment variables
| Name | Value |
|---|---|
| `GEMINI_API_KEY` | your Google AI Studio key |
| `REVIEWERS` | `name:password,name2:password2` (passwords 6+ characters). These become the reviewer logins. |
| `DATABASE_URL` | added automatically by the Neon integration |
| `RIVERLENS_MODEL` | optional. If unset the app uses `gemini-3.8-flash`, and automatically tries other models your key supports if that one is slow or unavailable. |
| `SESSION_SECRET` | optional, any long random text |
Variables only apply after a redeploy.

## Check that it works
- `/api/status` shows `"version":"community-1"`, `ai_configured`, `db_configured` and `reviewers_configured`.
- `/api/diag` (log in as a reviewer first) lists the models your key can use and times a test call.
