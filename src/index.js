const OWNER = 'GHLists';
const REF = 'main';

const WORKFLOWS = [
	{ repo: 'new-wikipedia-articles', file: 'hourly-new-articles.yml' },
	{ repo: 'new-npm-packages', file: 'hourly-new-packages.yml' },
	{ repo: 'new-pypi-packages', file: 'hourly-new-packages.yml' },
	{ repo: 'wikipedia-top-1000', file: 'daily-top-1000.yml', hour: 2 },
];

async function dispatch(env, workflows = WORKFLOWS) {
	const results = await Promise.all(
		workflows.map(async ({ repo, file }) => {
			const url = `https://api.github.com/repos/${OWNER}/${repo}/actions/workflows/${file}/dispatches`;
			try {
				const response = await fetch(url, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${env.GITHUB_TOKEN}`,
						Accept: 'application/vnd.github+json',
						'X-GitHub-Api-Version': '2022-11-28',
						'User-Agent': 'ghlists-dispatcher',
					},
					body: JSON.stringify({ ref: REF }),
				});
				if (response.status === 204) {
					return { repo, ok: true };
				}
				return {
					repo,
					ok: false,
					status: response.status,
					error: (await response.text()).slice(0, 300),
				};
			} catch (error) {
				return { repo, ok: false, error: String(error) };
			}
		}),
	);
	for (const result of results) {
		console.log(JSON.stringify(result));
	}
	return results;
}

export default {
	// Cloudflare Cron Trigger entrypoint.
	async scheduled(controller, env, ctx) {
		const hour = new Date(controller.scheduledTime).getUTCHours();
		const due = WORKFLOWS.filter((item) => item.hour === undefined || item.hour === hour);
		ctx.waitUntil(dispatch(env, due));
	},

	// Manual entrypoint: https://<worker>/?key=<DISPATCH_KEY> or ?key=...&repo=new-npm-packages
	async fetch(request, env) {
		const url = new URL(request.url);
		if (!env.DISPATCH_KEY || url.searchParams.get('key') !== env.DISPATCH_KEY) {
			return new Response('forbidden\n', { status: 403 });
		}
		const only = url.searchParams.get('repo');
		const workflows = only ? WORKFLOWS.filter((item) => item.repo === only) : WORKFLOWS;
		if (workflows.length === 0) {
			return Response.json({ error: `unknown repo: ${only}` }, { status: 404 });
		}
		const results = await dispatch(env, workflows);
		const ok = results.every((result) => result.ok);
		return Response.json({ results }, { status: ok ? 200 : 502 });
	},
};
