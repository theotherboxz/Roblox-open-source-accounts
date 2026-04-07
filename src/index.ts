/**
 * Google Drive-backed storage for Cloudflare Workers.
 *
 * This worker uses a Google service account to authenticate, then reads and writes
 * a single Drive file containing a JSON array of stored credentials.
 *
 * Configure the following environment variables in your Worker deployment:
 * - GOOGLE_SERVICE_ACCOUNT_JSON
 * - GOOGLE_DRIVE_FILE_ID
 */

export interface Env {
GOOGLE_SERVICE_ACCOUNT_JSON?: string;
GOOGLE_DRIVE_FILE_ID?: string;
}

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiry = 0;

export default {
async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
const url = new URL(request.url);

if (request.method === 'GET') {
if (url.pathname === '/') {
return handleHomePage(env);
} else if (url.pathname === '/api/credentials' || url.pathname === '/data') {
return handleGetCredentials(env);
} else if (url.pathname === '/api/health') {
return handleHealthCheck(env);
}
}

if (request.method === 'POST') {
if (url.pathname === '/api/credentials' || url.pathname === '/receive') {
return handleStoreCredentials(request, env);
}
}

return new Response('Not Found', { status: 404 });
},
};

async function handleHomePage(env: Env): Promise<Response> {
const statusBlock = getStorageStatusBlock(env);

try {
const data = await getStoredData(env);
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
${statusBlock}
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
entries: data.length,
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
route: new URL(request.url).pathname,
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

function getStorageStatusBlock(env: Env): string {
if (!env.GOOGLE_SERVICE_ACCOUNT_JSON || !env.GOOGLE_DRIVE_FILE_ID) {
return '<p style="color: red;">Google Drive storage is not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_FILE_ID in your Worker environment.</p>';
}
return '';
}

async function getStoredData(env: Env): Promise<any[]> {
if (!env.GOOGLE_SERVICE_ACCOUNT_JSON || !env.GOOGLE_DRIVE_FILE_ID) {
return [];
}

const token = await getGoogleDriveAccessToken(env);
const fileId = env.GOOGLE_DRIVE_FILE_ID;
const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
headers: {
Authorization: `Bearer ${token}`,
},
});

if (response.status === 404) {
return [];
}

if (!response.ok) {
const errorText = await response.text();
throw new Error(`Failed to load Drive file: ${response.status} ${response.statusText} ${errorText}`);
}

const text = await response.text();
if (!text) {
return [];
}

try {
return JSON.parse(text);
} catch {
return [];
}
}

async function saveStoredData(env: Env, data: any[]): Promise<void> {
if (!env.GOOGLE_SERVICE_ACCOUNT_JSON || !env.GOOGLE_DRIVE_FILE_ID) {
throw new Error('Google Drive storage is not configured.');
}

const token = await getGoogleDriveAccessToken(env);
const fileId = env.GOOGLE_DRIVE_FILE_ID;
const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
method: 'PATCH',
headers: {
Authorization: `Bearer ${token}`,
'Content-Type': 'application/json; charset=UTF-8',
},
body: JSON.stringify(data),
});

if (!response.ok) {
const errorText = await response.text();
throw new Error(`Failed to save Drive file: ${response.status} ${response.statusText} ${errorText}`);
}
}

interface GoogleServiceAccount {
type: string;
project_id: string;
private_key_id: string;
private_key: string;
client_email: string;
client_id: string;
auth_uri: string;
token_uri: string;
auth_provider_x509_cert_url: string;
client_x509_cert_url: string;
}

async function getGoogleDriveAccessToken(env: Env): Promise<string> {
const now = Math.floor(Date.now() / 1000);
if (cachedAccessToken && cachedAccessTokenExpiry - 60 > now) {
return cachedAccessToken;
}

const rawJson = env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!rawJson) {
throw new Error('Google service account JSON is not configured.');
}

let serviceAccount: GoogleServiceAccount;
try {
serviceAccount = JSON.parse(rawJson) as GoogleServiceAccount;
} catch {
throw new Error('Invalid JSON provided for GOOGLE_SERVICE_ACCOUNT_JSON.');
}

if (!serviceAccount.client_email || !serviceAccount.private_key) {
throw new Error('Service account JSON is missing required fields.');
}

const iat = now;
const exp = iat + 3600;
const jwtHeader = { alg: 'RS256', typ: 'JWT' };
const jwtPayload = {
iss: serviceAccount.client_email,
scope: 'https://www.googleapis.com/auth/drive.file',
aud: 'https://oauth2.googleapis.com/token',
exp,
iat,
};

const unsignedJwt = `${base64UrlEncode(JSON.stringify(jwtHeader))}.${base64UrlEncode(JSON.stringify(jwtPayload))}`;
const signature = await signJwt(unsignedJwt, serviceAccount.private_key);
const assertion = `${unsignedJwt}.${signature}`;

const response = await fetch('https://oauth2.googleapis.com/token', {
method: 'POST',
headers: {
'Content-Type': 'application/x-www-form-urlencoded',
},
body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(assertion)}`,
});

if (!response.ok) {
const errorText = await response.text();
throw new Error(`Google OAuth token request failed: ${response.status} ${response.statusText} ${errorText}`);
}

const tokenResponse = await response.json() as { access_token?: string; expires_in?: number };
if (!tokenResponse.access_token || !tokenResponse.expires_in) {
	throw new Error('Received invalid token response from Google.');
}

cachedAccessToken = tokenResponse.access_token;
cachedAccessTokenExpiry = now + Number(tokenResponse.expires_in);
return cachedAccessToken!;
}

function base64UrlEncode(value: string | Uint8Array): string {
const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
let binary = '';
const chunkSize = 0x8000;
for (let i = 0; i < bytes.length; i += chunkSize) {
binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
}
return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
const clean = pem
.replace(/-----BEGIN [^-]+-----/g, '')
.replace(/-----END [^-]+-----/g, '')
.replace(/\s+/g, '');
const binary = atob(clean);
const bytes = new Uint8Array(binary.length);
for (let i = 0; i < binary.length; i++) {
bytes[i] = binary.charCodeAt(i);
}
return bytes.buffer;
}

async function signJwt(unsignedJwt: string, privateKey: string): Promise<string> {
const keyData = pemToArrayBuffer(privateKey);
const key = await crypto.subtle.importKey(
'pkcs8',
keyData,
{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
false,
['sign'],
);
const signature = await crypto.subtle.sign(
{ name: 'RSASSA-PKCS1-v1_5' },
key,
new TextEncoder().encode(unsignedJwt),
);
return base64UrlEncode(new Uint8Array(signature));
}
