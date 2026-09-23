# ghlists-dispatcher

Starts the hourly GHLists workflows through GitHub's `workflow_dispatch` API,
without relying on GitHub's own cron scheduler. Deployed as a Cloudflare Worker
with a Cron Trigger.

Repositories and workflows:

| Repository | Workflow file |
| :--------- | :------------ |
| `GHLists/new-wikipedia-articles` | `.github/workflows/hourly-new-articles.yml` |
| `GHLists/new-npm-packages` | `.github/workflows/hourly-new-packages.yml` |
| `GHLists/new-pypi-packages` | `.github/workflows/hourly-new-packages.yml` |
| `GHLists/new-maven-central-artifacts` | `.github/workflows/hourly-new-artifacts.yml` |

## Setup

```bash
npm install
npx wrangler login          # or: export CLOUDFLARE_API_TOKEN=...
npx wrangler secret put GITHUB_TOKEN    # fine-grained PAT, Actions: Read and write
npx wrangler secret put DISPATCH_KEY    # see .dev.vars for the generated key
npx wrangler deploy
```

The cron trigger is defined in `wrangler.toml` and runs every hour at `:07`
UTC. New or changed triggers can take up to ~15 minutes to propagate.

## Testing

Local (uses `.dev.vars`, no deploy needed):

```bash
npm run dev
curl "http://localhost:8787/cdn-cgi/local/scheduled"
```

Local dispatch script (same calls the Worker makes):

```bash
./dispatch.sh
```

Deployed Worker (manual run):

```bash
curl "https://ghlists-dispatcher.<your-subdomain>.workers.dev/?key=$DISPATCH_KEY"
curl "https://ghlists-dispatcher.<your-subdomain>.workers.dev/?key=$DISPATCH_KEY&repo=new-pypi-packages"
```

Logs: `npx wrangler tail`, or Workers → your Worker → Settings → Trigger Events.

## Notes

- `GITHUB_TOKEN` is stored in `.dev.vars` for local development and must be set
  as a Worker secret for the deployed version. `.dev.vars` is gitignored.
- The Worker only starts the workflows; fetching and committing still happens in
  the GitHub Actions jobs.
- If GitHub's scheduler starts working again, you will get double runs. Remove
  the `schedule:` block from the workflows to make the Worker the only trigger.
- Fine-grained PATs expire; non-204 responses are logged (`wrangler tail`) so a
  broken token is visible.
- Cron triggers are UTC and use Quartz-like syntax (weekdays `1=SUN … 7=SAT`).
