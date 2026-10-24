# CampusBond

A university community app for students, alumni and administrators. Built with React, Express and MongoDB.

## Local setup

Run `npm install`, `npm install --prefix frontend` and `npm install --prefix backend`. Copy `backend/.env.example` to `backend/.env` and fill in your MongoDB URI, JWT secret and frontend origin. Use Atlas or a replica set.

Start with `npm run dev` (frontend: 5173, API: 4000). The launcher runs Node directly, so Windows does not need a terminal PATH workaround. Database outages return 503 while startup retries; TLS verification stays enabled. `npm run dev:local` uses a temporary local database. Run `npm test` and `npm run build` before pushing.

## Deployment

After the folder rename, use `frontend` as the Vercel Root Directory. If Render used `server`, change its Root Directory to `backend` (build: `npm install`, start: `npm start`). For a Render service rooted at the repository, keep that root and use `npm start`.

Vercel hosts the frontend; Render hosts the API. Match the API URL in `frontend/vercel.json` and set `FRONTEND_ORIGIN`, `NODE_ENV=production` and `JWT_SECRET` on Render. SMTP is needed for password recovery.

Render uses one trusted proxy hop by default. Other hosts can configure `TRUST_PROXY_HOPS`; local direct access uses 0.

The current Super Admin is the owner. Existing role permissions apply. Donations use manual wallet payments with owner/admin review.
