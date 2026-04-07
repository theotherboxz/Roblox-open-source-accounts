/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787 to see your worker in action
 * - Run `wrangler deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	CREDENTIALS_STORE?: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Handle GET requests
		if (request.method === 'GET') {
			if (url.pathname === '/') {
				return handleHomePage(env);
			} else if (url.pathname === '/api/credentials' || url.pathname === '/data') {
				return handleGetCredentials(env);
			} else if (url.pathname === '/api/health') {
				return handleHealthCheck(env);
			}
		}

		// Handle POST requests
		if (request.method === 'POST') {
			if (url.pathname === '/api/credentials' || url.pathname === '/receive') {
				return handleStoreCredentials(request, env);
			}
		}

		// 404 for unknown routes
		return new Response('Not Found', { status: 404 });
	},
};

async function handleHomePage(env: Env): Promise<Response> {
	try {
		const data = await getStoredData(env);
		const kvStatus = env.CREDENTIALS_STORE ? '' : '<p style="color: red;">KV namespace is not configured. This worker will build, but storage will not persist until you configure KV and update wrangler.toml.</p>';
		const html = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta http-equiv="refresh" content="5">
	<title>Credential Storage</title>
	<style>
		body { font-family: Arial, sans-serif; background: #f4f4f9; margin: 0; padding: 0; }
		.container { max-width: 900px; margin: 24px auto; padding: 20px; background: #fff; border-radius: 10px; box-shadow: 0 2px 14px rgba(0,0,0,0.08); }
		h1 { margin-top: 0; }
		.item { margin: 12px 0; padding: 14px; border-radius: 8px; background: #fafafa; border: 1px solid #e0e0e5; }
		.item pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: Consolas, monospace; }
		.meta { color: #555; margin-bottom: 12px; }
		.empty { color: #777; margin: 16px 0; }
	</style>
</head>
<body>
	<div class="container">
		<h1>Stored Credentials</h1>
		<div class="meta">Entries: ${data.length} | Auto-refreshes every 5 seconds</div>
		<p>Send JSON to <code>/api/credentials</code> to store new items.</p>
		${kvStatus}
		${renderItems(data)}
	</div>
</body>
</html>
		`;
		return new Response(html, {
			headers: { 'Content-Type': 'text/html; charset=utf-8' },
		});
	} catch (error) {
		return new Response('Error loading page', { status: 500 });
	}
}

async function handleGetCredentials(env: Env): Promise<Response> {
	try {
		const data = await getStoredData(env);
		return new Response(JSON.stringify(data, null, 2), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Failed to retrieve data' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

async function handleHealthCheck(env: Env): Promise<Response> {
	try {
		const data = await getStoredData(env);
		return new Response(JSON.stringify({
			status: 'ok',
			entries: data.length
		}), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		return new Response(JSON.stringify({ status: 'error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

async function handleStoreCredentials(request: Request, env: Env): Promise<Response> {
	try {
		const payload = await request.json();

		if (!payload || typeof payload !== 'object') {
			return new Response(JSON.stringify({ error: 'No JSON object provided' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const stored = await getStoredData(env);
		stored.push(payload);
		await saveStoredData(env, stored);

		return new Response(JSON.stringify({
			message: 'Data stored successfully',
			route: new URL(request.url).pathname
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		return new Response(JSON.stringify({ error: error.message || 'Invalid JSON or storage error' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

function renderItems(data: any[]): string {
	if (!data || data.length === 0) {
		return '<div class="empty">No data received yet. Send a POST to <code>/api/credentials</code>.</div>';
	}

	return data.map(item => {
		const jsonText = JSON.stringify(item, null, 2);
		return `<div class="item"><pre>${jsonText}</pre></div>`;
	}).join('');
}

async function getStoredData(env: Env): Promise<any[]> {
	if (!env.CREDENTIALS_STORE) {
		return [];
	}

	try {
		const data = await env.CREDENTIALS_STORE.get('credentials');
		return data ? JSON.parse(data) : [];
	} catch (error) {
		console.error('Error getting stored data:', error);
		return [];
	}
}

async function saveStoredData(env: Env, data: any[]): Promise<void> {
	if (!env.CREDENTIALS_STORE) {
		throw new Error('KV namespace binding is not configured.');
	}

	try {
		await env.CREDENTIALS_STORE.put('credentials', JSON.stringify(data));
	} catch (error) {
		console.error('Error saving data:', error);
		throw error;
	}
}