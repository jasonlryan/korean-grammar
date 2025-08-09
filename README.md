## Korean Grammar in Use (Advanced)

Static site + optional on-demand example generation via an API powered by OpenAI. Deployed on Vercel.

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm
- An OpenAI API key with access to the `gpt-4.1-mini` model

### Environment

Create a `.env` in the project root for local development:

```
OPENAI_API_KEY=your_openai_api_key
```

On Vercel, add the same environment variable in Project Settings → Environment Variables for both Preview and Production.

### Install

```
npm install
```

### Local Development

- Start static site + local dev API in parallel:

```
npm run dev
```

This runs the web app at `http://localhost:800` and an Express dev API at `http://localhost:8787`.

Notes:

- The site will call the dev API locally and the serverless API (`/api/generate-examples`) in production automatically.
- If ports are busy, `npm run dev` attempts to free `800`, `8787`, and `3000` first.

#### Just the static site

```
npm run serve
```

### Example Generation (CLI)

You can generate and persist examples into `grammar.json`:

```
# Generate for a single pattern
npm run generate-examples -- "-(으)ㄹ 따름이다"

# Or generate a batch (first 5 without examples)
npm run generate-examples
```

This script requires `OPENAI_API_KEY`. It updates `grammar.json` in place.

### Content utilities

- Build/validate content:

```
npm run build-content
```

This runs `extract`, `merge`, `apply-updates`, and `validate`.

### Deployment (Vercel)

1. Set `OPENAI_API_KEY` in Vercel → Project Settings → Environment Variables (Preview + Production).
2. Push to `main` to trigger a deploy, or redeploy from the Vercel dashboard.
3. The serverless API lives at `/api/generate-examples` and is auto-routed by Vercel.

Test the API (Production):

```
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "pattern": "-(으)ㄹ 따름이다",
    "description": "Formal expression meaning 'just/only'",
    "tip": "Often used in formal contexts",
    "existingExample": "감사할 따름입니다."
  }' \
  https://your-domain.vercel.app/api/generate-examples
```

### Troubleshooting

- Cannot generate examples on Vercel:

  - Ensure `OPENAI_API_KEY` is set in Vercel (Preview/Production) and redeploy.
  - Confirm your plan has access to `gpt-4o-mini`.
  - Check Vercel function logs for `/api/generate-examples`.

- 404 or HTML response from API:

  - The `vercel.json` includes `{ "handle": "filesystem" }` first, so API routes should work. If modified, ensure the filesystem handler precedes the SPA catch-all.

- Invalid JSON from model:

  - The API returns 502 with the raw content if the model response is not valid JSON. Retry the request.

- Local dev API not used:
  - The site auto-detects `localhost` and targets `http://localhost:8787` for the API; otherwise it uses the relative `/api/generate-examples`.

### Tech Notes

- Frontend is a static HTML app served from `index.html`.
- Serverless API: `api/generate-examples.js` (OpenAI Chat Completions, `gpt-4.1-mini`).
- Local dev API proxy: `scripts/dev-api.mjs`.
- Routing: `vercel.json` serves files first, then SPA fallback to `index.html`.
