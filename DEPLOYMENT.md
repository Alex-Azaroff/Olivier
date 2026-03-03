Vercel deployment notes

Project: Olivier

Deployed URLs:
- Production (unique): https://olivier-4ug42yrqj-alex-azaroffs-projects.vercel.app
- Alias: https://olivier-orcin.vercel.app

How this was deployed (actions taken):
1. I pushed the current workspace to GitHub (forced update of `main`).
2. Added `vercel.json` to configure Vite build output (`dist`) and SPA routing.
3. Installed Vercel CLI locally and logged in via `vercel login` (device flow).
4. Ran `vercel --prod --name olivier --yes` from the project root to create the Vercel project and deploy to production.

Notes / Next steps:
- The project is linked to a Vercel project named `olivier` under the account/org `alex-azaroffs-projects`.
- Environment variables for development were downloaded into `.env.local` (and `.env.local` is gitignored).
- To update the site, push to `main` (if Git integration is enabled) or run `vercel --prod --yes` locally.
- If you want the project to use a custom domain, add it via the Vercel dashboard and follow the DNS instructions.

If you want I can also add a GitHub Action to deploy automatically using a Vercel token — tell me if you'd like that and I will add the workflow and instructions for adding `VERCEL_TOKEN` to GitHub Secrets.
