# NUB Connect

A JavaScript MERN application for a verified university community. React/Vite/Tailwind client, Express REST API, Mongoose/MongoDB database, and integration tests using a real isolated MongoDB replica set.

## Requirements

- Node.js 22.12+ (or a newer supported version), npm, and MongoDB 7+.
- MongoDB Atlas or a MongoDB replica set. Transactions are required for account provisioning, conversion review, mentorship transitions, messaging, and contribution review. The API deliberately refuses a standalone MongoDB server.
- HTTPS and a same-origin reverse proxy for production. Gmail SMTP (or another SMTP provider) is required only for password recovery. No payment provider is required for manual contribution records.

## Install and run

From the project root:

```powershell
npm ci
Copy-Item .env.example .env
```

Edit `.env`. Set a real MongoDB replica-set URI, a random JWT secret of at least 32 characters, the frontend origin, and your own bootstrap credentials. Never commit this file. The server reads the root `.env` even when launched through an npm workspace.

For local MongoDB, start an installed MongoDB server with a replica set (use a directory you own):

```powershell
New-Item -ItemType Directory -Force .mongodb
mongod --dbpath .mongodb --replSet rs0 --bind_ip 127.0.0.1
# In another terminal:
mongosh --eval "rs.initiate()"
```

Wait for the replica set to elect its primary. Alternatively use an Atlas connection string.

```powershell
npm run seed
npm run dev
```

Open [NUB Connect](http://localhost:5173). The API listens on port 4000 and Vite proxies `/api` to it. The seed command creates exactly one Super Admin using the environment credentials; it refuses to run once a Super Admin exists. There are no built-in passwords or unrestricted registrations.

1. Sign in as the Super Admin with the bootstrap email or ID.
2. Create administrators, or create Student/Alumni accounts under **Manage members** or **Verified accounts**, selecting a department and setting an initial password.
3. A new member signs in immediately with the administrator-issued email or university ID and password. No account-verification email is sent. Public registration is disabled.
4. Students find alumni mentors and request guidance. The selected alumnus accepts or rejects the request.
5. Only accepted connections appear in Messages and may access conversation history or send messages.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start API and Vite concurrently |
| `npm test` | Run API integration tests against an isolated MongoDB replica set |
| `npm run build` | Build production client into `client/dist` |
| `npm start` | Start the production API |
| `npm run seed` | Bootstrap the first Super Admin |

The first test run downloads a MongoDB binary through `mongodb-memory-server` (Windows x64, MongoDB 7.0.14). Internet access is needed for that download. Tests never use `MONGODB_URI` or your production database. You can point `MONGOMS_SYSTEM_BINARY` to a compatible local MongoDB executable to avoid downloading. Test fixtures are created only in the isolated test database.

## Implemented workflows

- Student, alumni, admin, and Super Admin dashboards with database counts and role-specific navigation.
- Administrator-issued accounts, email/university-ID login, logout, password changes, profile editing, and inactive-account denial.
- Alumni discovery and profiles; student mentorship requests; selected-mentor accept/reject; Alumni-only completion.
- Persisted mentorship conversations with strict API authorization on every history request and send; 15-second refresh while a conversation is open.
- Paginated newsfeed with actual author names and author/moderator edit/delete controls.
- Jobs with search, type filtering on the API, ownership, closing dates, statuses, and optional HTTPS application links. Alumni can manage their listings; admins can moderate all listings.
- Events with administrator creation/edit/delete, registration, capacity enforcement, duplicate prevention, participant lists, and cancellation.
- Donation campaigns, manual contribution references, private member history, administrator approval/rejection, and approved totals.
- Persisted notifications, unread counts, individual read/unread and mark-all-read.
- Administrator management of member activation and verification records; Super Admin creation/activation/deactivation of ordinary administrators.
- Super Admin-only Activity page with General Admin, Alumni and Student sections, user-wise summaries, per-user timelines, search/date filters, and numbered 20-row pagination.
- Manage Members defaults to students and supports permitted role, name/email/ID, batch and department search with numbered 20-row pagination.
- Responsive navy/emerald interface, mobile navigation, loading/error/empty states, keyboard focus indicators, and reduced-motion support.

## Policies and scope

**Mentorship:** one request record per student/mentor pair for its lifetime, enforced by a unique index. The Find Mentor list and public Alumni profile return only the signed-in student's relationship status; submission updates the UI immediately and refresh preserves it. Only the selected Alumni can accept/reject a pending request or complete an accepted relationship. Acceptance has no expiry and never requires accepting again. A Student sees a Message link on the accepted Alumni profile, but waits until the Alumni sends the first valid message. Only then does the conversation appear in the Student's Messages list and permit replies. Every send rechecks participant identity, roles, active accounts, accepted status and Alumni initiation in a transaction. Completion serializes against writes and permanently closes the composer; original eligible participants retain read-only history. Pending/rejected/outsider/admin access is denied. Graduation-conversion archives keep their separate original-participant permissions. Existing Alumni-authored messages satisfy the first-message requirement without changing old messages. Messages are text-only; attachments, edits, replies and file downloads are not implemented.

**Events:** bookings are transactional and capacity-checked. Confirmation copies name, email, university ID and phone from the member account into an organizer-only registration snapshot. Phone is required before booking. Owners/administrators see paginated participants, add existing active members manually and remove participation. Removal changes the active count and immediately frees capacity; a cancelled member can rebook. Deadlines and event status are enforced. Event deletion removes public visibility while retaining registration history. Times are stored in UTC and shown in the viewer’s timezone.

**Donations:** all amounts are BDT. This website records manual contributions and never charges a card or claims to transfer money. An administrator checks an external receipt/reference and makes a single final approve/reject decision. Approved totals are calculated from contribution records. Campaigns can be closed; financial records are retained. No payment gateway, card entry, or banking credentials are present.

**Administration:** ordinary admins manage students/alumni; only the current Super Admin manages administrators. The owner may transfer ownership to a different active Admin after confirming their current password. A MongoDB transaction promotes the target, demotes the old owner, changes the singleton Ownership record, and revokes both accounts’ old sessions. The old owner receives a fresh ordinary-Admin session. Other endpoints cannot promote accounts or modify/delete the owner. Ownership changes serialize against management actions, so stale privileges cannot be reused. Bootstrap creation uses the same singleton lock; startup migrates the legacy unique-role index to allow atomic ownership transfers.

**Account controls:** Edit updates name, email, university ID, and department; claimed verification edits also update the linked member, and member edits update its verification record. Activated roles cannot be changed. Email/ID conflicts roll back the entire transaction. Suspend and Block are distinct stored states, both denying login and revoking existing sessions; Reactivate restores access. Suspension lasts until an administrator reactivates the account. Verification status changes propagate to activated linked members. All these changes are recorded in AdminAudit without passwords or hashes.

**Deletion:** Delete is a retained-record deletion: the user/verification record receives status deleted, loses access, and disappears from management lists. Linked verification/member accounts are deleted together. Existing posts, conversations, mentorship, event and financial history keep valid references. Deleted email/ID identifiers remain reserved to prevent impersonation or accidental reactivation; no restore endpoint is exposed. The UI requires typing DELETE before removal. Ownership transfer requires typing TRANSFER and re-entering the owner’s current password. Tests perform these operations only in isolated databases.

**Accounts:** new administrator-issued accounts remain pending email verification. Forgot password sends a branded single-use reset link valid for 30 minutes. Verification links last 24 hours. Both use random tokens stored only as hashes; reset revokes sessions and other outstanding links. Suspended/blocked/deleted accounts cannot recover into active access. Public recovery replies do not disclose whether an email exists. Profile and optional post-cover pictures are sanitized WebP assets in MongoDB. No general encrypted attachments, sockets or payment processing are claimed. Manage Members and Activity return at most 20 records; feed/resource lists return at most 12, with comment/participant pages of 20.

## Authentication and security architecture

- JWTs last eight hours and are stored only in HTTP-only, SameSite=Strict cookies. Production cookies use Secure. Tokens include issuer/audience and a per-user version checked against the database on every authenticated request. Logout and password change revoke older sessions.
- State-changing endpoints, including login, require a random double-submit CSRF cookie/header pair. The browser obtains the value via `GET /api/v1/csrf`; the client keeps it in memory. Origin checks and explicit credentialed CORS add protection. Neither JWTs nor passwords are stored in localStorage.
- bcrypt hashes passwords at cost 12. Passwords require at least 11 characters and at most 72 UTF-8 bytes; the API validates public inputs and selects explicitly permitted update fields. Role changes cannot be smuggled into provisioning/profile payloads.
- Helmet headers, 64 KB JSON limit, global API rate limiting, stricter login/registration rate limiting, validated ObjectIds, escaped text search, ownership checks, and centralized error responses are installed. Production does not return stack traces.
- Unique email/university ID, mentorship pair, and member/contribution-reference indexes prevent conflicting records. Transactions serialize mentorship status changes against message writes. Event reservations use a single-document conditional update.
- Profile endpoints omit private email/ID/password fields. Message history is participant-only; contributions are private to their member or administrators. Event participant contact information is administrator-only.
- This is an application security baseline, not a claim of complete security. For deployment, add monitoring, backups, an audit retention policy, dependency updates, and an operational recovery procedure appropriate to your university.

## Models and relationships

`User` holds member details and roles. `VerifiedUser` authorizes a matching email/ID once. `Mentorship` references its student and mentor; `Message` references that relationship and a sender. `Post` references its author; `Job`, `Event`, and `Donation` reference their owner. An event embeds its registration records to make capacity enforcement atomic. `Contribution` references its campaign/member/reviewer. `Notification` references its recipient. Accounts use retained-record deletion, preserving authorship and financial/mentorship history. Ownership stores the singleton current owner, and AdminAudit stores successful management actions.

Account workflows live in `server/src/management.js` and the ownership upgrade in `server/src/migrations.js`. The models are in `server/src/models.js`; authorization helpers in `server/src/security.js`; workflow routes in `server/src/routes.js`; startup in `server/src/server.js`. The client uses shared UI primitives in `client/src/components/ui.jsx`, API-backed community/resource/account pages in `client/src/pages`, and the routing layout in `client/src/main.jsx`, with responsive styles in `client/src/style.css`.

## REST API

Prefix: `/api/v1`. JSON response shapes are `{ item }`, `{ user }`, or paginated `{ items, total, page, pages }`; errors return `{ message, errors? }`. Mutations require CSRF. CSRF, login and email recovery/verification routes are public; other routes require an active session. Public registration is disabled.

| Endpoint | Methods / permissions |
| --- | --- |
| `/csrf` | GET, public token initialization |
| `/auth/login` | POST, public with credentials; `/auth/register` is disabled (403) |
| `/auth/me`, `/auth/logout`, `/auth/password` | GET / POST / PUT, current account |
| `/dashboard` | GET, role-appropriate database counts |
| `/users/me`, `/users/:id` | PATCH own allowed fields / GET public profile |
| `/mentors` | GET; optional `q`, `page` |
| `/mentorships` | GET own / POST student request |
| `/mentorships/:id` | PATCH authorized transition |
| `/conversations` | GET accepted student/alumni connections |
| `/conversations/:id/messages` | GET history / POST text; accepted participants only |
| `/posts`, `/posts/:id` | GET list / POST; PATCH or DELETE author/admin |
| `/jobs`, `/jobs/:id` | GET list/detail; POST alumni/admin; PUT/DELETE owner/admin |
| `/events`, `/events/:id` | GET list/detail; POST/PUT/DELETE admin |
| `/events/:id/register` | POST student/alumni reservation |
| `/events/:id/participants` | GET admin participant list |
| `/events/:id/registrations` | PATCH cancellation by registrant/admin |
| `/donations`, `/donations/:id` | GET list/detail; POST/PUT admin campaign |
| `/donations/:id/contributions` | POST member manual record |
| `/contributions`, `/contributions/:id` | GET own/admin list; PATCH admin final review |
| `/notifications`, `/notifications/:id`, `/notifications/read` | GET recipient list; PATCH read status / all-read |
| `/admin/users`, `/admin/users/:id` | POST provision Student/Alumni; GET searchable member list (default students; `role`, `q`, `batch`, `department`, `page`); PUT identity / PATCH active, suspended, or blocked / DELETE retained record |
| `/admin/verified-users`, `/admin/verified-users/:id` | GET/POST; PUT identity (including claimed accounts with linked-member synchronization); PATCH status; DELETE retained record |
| `/superadmin/admins` | GET/POST ordinary admins, Super Admin only |
| `/superadmin/admins/:id` | PUT edit / PATCH status / DELETE ordinary administrator, owner only |
| `/superadmin/activity/users` | GET grouped user-wise activity; Super Admin only; `role=admin|alumni|student`, `q`, `from`, `to`, `page` |
| `/superadmin/activity` | GET activity timeline; same filters plus optional `userId`; Super Admin only |
| `/superadmin/ownership/transfer` | POST `{ adminId, currentPassword }`, current owner only |
| `/health` | GET readiness; outside API prefix |

Example API session (use Postman’s cookie jar): GET `/csrf`, copy the response token to `X-CSRF-Token`, POST `/auth/login` with `{ "identifier": "your-id", "password": "your-password" }`, then retain cookies for protected calls. For history and messages the conversation ID is the mentorship record ID; arbitrary user IDs are never conversation IDs.

## Production deployment

1. Create a replica-set/Atlas database and a least-privileged application database user. Restrict network access and enable backups.
2. Set `NODE_ENV=production`, `FRONTEND_ORIGIN=https://your-host`, a strong secret, URI, and port in the hosting environment. Bootstrap the first Super Admin once, then remove bootstrap password variables.
3. `npm ci` and `npm run build`. Run `npm start` under a process supervisor.
4. Serve `client/dist` with an HTTPS web server, route `/api/` and `/health` to Express, and use `index.html` as the SPA fallback for frontend routes. Keep the client and API on the same origin for Strict cookies.
5. Terminate TLS at the reverse proxy, impose request/time limits, configure proxy-aware rate limiting for your known proxy topology, and monitor `/health`. Do not blindly trust arbitrary forwarded IP headers. The API defaults to trusting no proxy.
6. Run the tests and manually verify your provider, origins, TLS/cookies, and backups before exposing the application.

## Verification record

See `VERIFICATION.md` for the checks actually executed in this workspace and their results. External Atlas connectivity, production hosting, production hosting and payment processing require separate configuration. Gmail SMTP and a real owner recovery have been verified in this workspace; see the latest verification entry.

## Quick temporary local preview

After installing dependencies, `npm run dev:local` starts Vite, the API, and a real temporary MongoDB replica set without requiring Atlas or a MongoDB installation. It prints a randomly generated local Super Admin password in your terminal for `owner@university.test`. Open http://localhost:5173 and use that account to authorize members. This mode is explicitly for local evaluation: all data is deleted on shutdown and a new owner/password is generated on restart. Use the `.env` workflow above for persistent data. The first run needs internet access to download MongoDB, or `MONGOMS_SYSTEM_BINARY` pointing to your local binary. Port 4000 and 5173 must be free.



## Activity and scalable member search

Only the Super Admin sees the Activity navigation item or can call its API. General Admin, Alumni and Student are separate sections. A section first shows users with recorded actions, their counts and latest action; View activity opens that user's timeline. Role classification is captured at the time of each action, so a later role/ownership change does not rewrite history. Successful sign-ins, account provisioning, sign-out, password/profile changes, posts, mentorship actions, messages sent, jobs, events, manual contributions, notification changes, and management mutations are recorded by the backend. Opening Activity or other GET pages does not create activity.

Recording starts when this feature is enabled; earlier actions are not invented or backfilled. Stored data consists of actor ID, role at action time, action label, resource ID when available, route pattern and timestamp. Request bodies, passwords/hashes, message/post contents, and payment references are excluded. The owner may search a section by user name/email/ID, select a user, and filter dates (UI converts local date boundaries to UTC). Activity lists and user summaries use database aggregation and a fixed maximum of 20 results per page. Logging is written before a successful response and retried up to three times; a logging failure is reported in server logs without changing the outcome of an already committed business operation. This is operational activity history, not a transactional financial audit ledger.

Manage Members initially shows Student accounts. With the default role choice, entering a search/batch/department expands the search to all roles permitted for the viewer; an explicit role restricts it. Super Admin can select Admin, Alumni or Student; ordinary Admin can select only Alumni/Student. Search matches name, email, university ID, batch or department case-insensitively, with regex characters treated literally. Batch and Department filters combine with the main search. Deleted records and Super Admin accounts are excluded from this management list. A page contains at most 20 accounts; counts, stable name/ID ordering, Previous/Next and bounded numbered buttons support larger directories. Filters reset pagination to page 1, and typing is debounced. The browser fetches only the selected page rather than downloading every account.

Batch is an optional text field distinct from graduation year, editable by administrators. Account provisioning copies batch to the new member, and administrative member/claimed-verification edits synchronize it. Existing accounts remain unchanged until a batch is supplied. Role/name and role/batch/department indexes support the member directory; role/time and role/user/time indexes support activity retrieval. For much larger datasets or complex full-text relevance, a dedicated search index can be added later.

## Graduation conversion, profiles and administrator provisioning

Students submit graduation year, degree and an explanation under Alumni conversion. Admin and Super Admin review pending requests, accept or reject with a reason, and search request history. A student can have one pending request. Approval atomically changes the existing account to Alumni and updates its verification record; the user ID, authored content, contributions and other history remain intact. Existing sessions are revoked so the new role takes effect on sign-in. Concurrent reviewers cannot approve the same request twice.

Approval closes pending mentorship requests and completes accepted student relationships. The original active participants may read the resulting graduation archive, with 20 messages per page, but cannot send messages there. Administrators have no archive override. Ordinary Alumni-completed conversations have their own read-only history route and cannot be reopened for sending.

All roles can upload a profile picture and edit an introduction, qualifications and HTTPS social links. Alumni also manage multiple professional experience entries and create multiple job listings. Official identity, department and batch stay administrator-managed. Private profile phone numbers are excluded from community profiles. Job, Event and Donation forms offer a separate optional public contact number, displayed as a readable clickable telephone link.

Picture uploads accept PNG, JPG/JPEG, WebP, GIF and AVIF up to 5 MB. The server verifies actual image data, limits decoded pixels, applies orientation, removes metadata, resizes within 1200 x 1200 preserving aspect ratio, and stores a static WebP in MongoDB. Profile frames use cover fitting; GIF animation becomes a still picture. Assets require an active authenticated account. Upload throttling and CSRF apply. This is photo storage, not encrypted general attachment storage.

Create member and verified-account forms create an administrator-approved account in one transaction. Login is available immediately; no verification email is sent. Name, email, university ID, Student/Alumni role, department and an initial password are required; batch is optional. Administrator creation also requires a department. Passwords require 11 characters and at most 72 UTF-8 bytes. The selectable department catalog is maintained in server/src/catalog.js and can be adjusted to the university's actual departments. Matching eligible legacy verification records can be consumed, while blocked/deleted/claimed or conflicting identities are rejected. Public activation is removed; legacy /register URLs redirect to sign-in and the registration API rejects requests. Unauthenticated protected URLs redirect to sign-in and retain the internal destination.

Additional API endpoints (all under /api/v1):

| Endpoint | Access |
| --- | --- |
| `/admin/account-options` | GET administrator provisioning options |
| `/admin/users`, `/admin/verified-users` | POST administrator-issued member accounts |
| `/conversions` | GET own conversion history (Student/Alumni); POST Student request |
| `/admin/conversions`, `/admin/conversions/:id` | GET paginated review list; PATCH Admin/Super Admin decision |
| `/mentorships/:id/archive/messages` | GET conversion archive, original active participants only |
| `/users/me/avatar` | POST multipart field `image`; DELETE own picture |
| `/users/:id/avatar` | GET sanitized photo, active authenticated members |

These workflows are implemented in server/src/lifecycle.js, profiles.js and admin-access.js, with ConversionRequest and AvatarAsset models. Existing community history is preserved during local updates. A password reset requested by the member replaces only that account’s password.


## Gmail, verification and password recovery

See MAIL_SETUP.md for private configuration instructions. Put SMTP_USER and SMTP_PASS in the root .env.mail file; the server loads that private file when sending, so editing it does not require an API restart. Alternatively use environment variables in .env, or an absolute MAIL_CONFIG_PATH. Never put SMTP credentials in client source or any VITE_ variable. The current local runtime reads the private H: configuration file. Source archives exclude .env, .env.mail, database data and tokens.

A syntactically valid email does not prove mailbox ownership. Administrator-issued accounts can sign in directly; ordinary account creation and administrator email edits send no email. Email ownership is checked only during Forgot password using a single-use recovery link. No plaintext password is emailed. Legacy verification and resend endpoints return HTTP 410 and old verification-page URLs redirect to login.

Forgot password is on the login page. Public resend and recovery endpoints return generic responses, throttle requests, require CSRF and do not expose tokens in JSON. Links keep tokens in a browser fragment, and submission consumes them transactionally. Password reset uses the 11-character/72-byte rule, invalidates old sessions and old links, and requires login with the new password. The browser offers Show/Hide for password fields. Configure FRONTEND_ORIGIN to a real HTTPS domain before sending links to remote members; localhost links work only on the machine hosting the preview.

## Premium Newsfeed and resource publishing

The feed queries community updates, Jobs, Events and Donation campaigns directly, so publishing, editing, hiding, archiving or deleting a resource is reflected without a duplicate stale feed copy. Administrators publish community updates and moderate all feed types. Student/Alumni interfaces provide reading and interaction, while existing post-author API permissions remain supported for legacy content.

- For you prioritizes unseen posts matching the user's selected interests, then orders by newest timestamp. Unmatched unseen posts follow, avoiding an empty feed when matching content is unavailable.
- Latest includes all visible content in descending creation time. Viewed feed contains the current member's viewed content, also newest first. A browser IntersectionObserver marks a post only when at least 25% is visible; merely fetching JSON is not a view.
- Refresh feed fetches current data, resets to page 1 and starts a new unseen-feed session. A view cutoff keeps numbered pages stable as cards become viewed during that session. Browser reload also fetches fresh data.
- Interests are editable in the sidebar and persist in the account. Categories are explicit content topics, not inferred personal profiling or AI-generated labels.
- Five reactions can be selected, replaced or removed. Comments are paginated; their authors and administrators can delete them. Text is rendered safely by React.
- Share copies a link. Copying alone and the creator opening it do not increment the share count. An authenticated different viewer opening a valid shared link adds at most one share-view per post, across repeat opens and multiple links. Login preserves the shared internal destination. Counts represent unique qualifying viewers, not copy-button clicks.
- Administrators can Hide, Archive, Show/restore and Delete. Hidden/archived content is excluded from member feeds, dashboard previews and public resource lists. Owners retain management access to their archived resource; deletion is retained-record removal and cannot be restored through the UI. Existing participation and financial records remain.

Optional covers accept the same image formats as profile uploads, at most 5 MB. They are decoded, oriented, stripped of metadata, resized within 1800 x 1200 and stored as static WebP, then rendered with object-fit: cover and no empty side margins. PNG/JPEG/WebP/GIF/AVIF are supported. Invalid pictures are rejected. An interrupted cover upload can be retried against the saved post, avoiding duplicate creation. Owners can replace or remove a cover during editing.

Jobs include work mode, salary range, requirements, benefits and application email/HTTPS link. Events include organizer, end time, registration deadline, online meeting link and agenda. Campaigns include beneficiary, purpose and deadline alongside target and manual contribution instructions. A selected topic connects each resource to interest-based discovery. Fields remain optional where appropriate. Owner tools provide Edit/update, archive/show and retained deletion; administrators additionally hide content. Event organizers manage participants in a separate desktop side panel, stacked on smaller screens.

Additional API endpoints under /api/v1:

| Endpoint | Permission and behavior |
| --- | --- |
| /auth/forgot-password | POST public generic response; email; CSRF + throttling |
| /auth/reset-password | POST public; single-use recovery token; CSRF + throttling |
| Legacy email-verification/resend endpoints | HTTP 410; no email is sent |
| /feed/options | GET topic catalog |
| /feed | GET; mode=for-you/latest/viewed/moderation, page, optional ISO cutoff; moderation is admin-only |
| /feed/:kind/:id | GET unified post detail; kind=posts/jobs/events/donations |
| /feed/:kind/:id/view | POST current member's visible-card view |
| /feed/:kind/:id/reaction | PUT current member reaction or empty removal |
| /feed/:kind/:id/comments | GET paginated / POST comment |
| /feed/comments/:commentId | DELETE author/admin |
| /feed/:kind/:id/share | POST create copied-link path |
| /feed/:kind/:id/share-view | POST qualifying authenticated visit with share token |
| /feed/:kind/:id/visibility | PATCH administrator moderation |
| /jobs|events|donations/:id/cover | POST multipart image; GET authenticated photo; DELETE owner/admin |
| /jobs|events|donations/:id/visibility | PATCH owner/admin visibility; hide is admin-only |
| /events/:id/participants | GET paginated organizer/admin list; POST manually add an existing member |
| /donations/:id | DELETE owner/admin retained-record removal |

Implementation: server/src/mail.js and recovery.js handle email security; feed.js handles unified discovery and interactions; resources.js handles rich resources, covers and transactional bookings. Model references and unique indexes enforce per-member reactions, views and share attribution. These changes use Sharp 0.35.5 and Vitest 5.0.5; the final dependency audit reported zero vulnerabilities.

## Compact Newsfeed cards — 17 October 2026

Feed cards now use smaller typography, tighter padding, three-line excerpts and 160px desktop/140px mobile cover frames. Full community posts remain accessible through View full post. Comments open in a scrollable dialog, and owner/moderator tools open through Manage in the header. The stream displays a single text-only Like button that writes the existing Love reaction; a second click removes it. Other reaction types remain supported by the API for historical compatibility, but emoji controls and emoji reaction summaries are removed from this view.

## Add multiple members

Manage members and Verified accounts now offer **Add multiple members** to Admin and Super Admin. Import up to 100 Students/Alumni using CSV/TSV upload, a pasted spreadsheet table, or manually added editable rows. Download Template provides the supported headers: name, email, universityId, department, batch, role. Name/email/University ID are required; common department, batch and role fill empty columns. Enter an initial shared password separately; CSV input does not accept a password column.

1. Select common settings, load the list and edit any rows that need correction.
2. Check & preview validates every row with the same rules as individual provisioning. Duplicate email/ID values flag every affected row. Existing/deleted/blocked identities stay reserved, and only an eligible matching unclaimed verification record can be used. Preview creates no account and sends no email.
3. Create valid accounts processes ready rows automatically through the existing administrator provisioning endpoint. Each account has its own transaction; invalid rows are skipped. Progress and per-row results are visible. No verification emails are sent. This is a partial-success workflow, not a single all-or-nothing database transaction.
4. Keep the dialog/page open during creation. Stop after current account finishes the active request before stopping. Closing the dialog is disabled while validation/creation is active. If a connection or permission failure interrupts work, recheck the list; accounts already created remain saved and duplicate checks prevent re-creation. There is no background job that survives closing the browser.
5. Download results exports account details and outcomes without passwords. Spreadsheet formula prefixes are escaped. Newly created accounts can sign in immediately.

The new POST /api/v1/admin/users/bulk-preview endpoint is administrator-only, CSRF-protected and limited to 1–100 rows. It does not echo passwords or create misleading account-creation activity. Each actual creation is independently revalidated and audited by POST /admin/users, so a stale preview cannot bypass current identity, ownership or role checks. Imports preserve leading-zero IDs, quoted CSV fields and UTF-8 names. Files/pasted text are limited to 256 KB and API JSON requests to the existing 64 KB limit. XLSX files should first be saved as CSV.

## Animated welcome page

The public welcome page now uses the existing navy/emerald palette with a glass header, editorial hero, an animated university network scene, rotating circular NUB Connect typography, orbit lights, floating connection cards and subtle ambient motion. The center mark stays readable while the surrounding text rotates. Desktop pointer movement adds a small tilt without React re-rendering on every frame. Pause/Play controls stop/resume motion, and prefers-reduced-motion disables animation and pointer tilt.

The layout adapts from a desktop split hero to stacked mobile content, with community/career/event links, authenticated community navigation and a sign-in path for visitors. All illustrations are native SVG/CSS and need no external image or animation service. Decorative scene content is hidden from screen readers, navigation has visible keyboard focus, and a skip-to-content link is included. No fictional community counts are shown. Source: client/src/pages/Landing.jsx and welcome.css.

## Logo, timed suspensions and batch selection

The signed-in NUB Connect brand opens /app/feed; signed-out visitors go to the welcome page. Admins can suspend permitted members/verified accounts for 1–3650 whole days with an optional reason. Super Admins can also suspend ordinary administrators. Both linked records share the same expiry. Suspension immediately revokes existing sessions; early restore clears the deadline. Conditional expiry restores only due suspended records, never blocked/deleted records. The API checks expiry before requests, and the persistent server also checks every minute and on startup. Old sessions stay invalid after restoration; the member signs in again. Existing indefinite suspensions without a deadline remain unchanged until an administrator updates them.

Batch selectors support unselected Year & Season entry or manual values in account creation/edit, common bulk settings and member filters. Spring 2022 is batch 45, Summer 46, Fall 47, and each year has three terms. Earlier/later positive batches follow the same formula. Existing manual batch strings are preserved. No year, season or batch is preselected for a new record. Administrator profiles do not receive academic batch fields. Numeric batch filtering is exact; legacy year/term-text searches remain supported.

## Portable project folder

Application source, root node_modules, configuration and private backups are kept together. Both client and server resolve dependencies from the root node_modules; no absolute workspace junctions are required on FAT32 USB drives. Start from the project root with npm run dev, or double-click START.cmd on Windows. Startup does not require the old C-drive working copy. SMTP settings use the project-local .env.mail by default.

On another Windows computer, install a supported Node.js version and allow that machine's outbound IP in Atlas. Existing Windows dependencies can be reused on a compatible Windows architecture/Node version. For a different OS/architecture or incompatible native modules, run npm ci in the project root to reinstall from package-lock.json. Keep .env, .env.atlas, .env.mail and .local-data private; they are not part of the source ZIP.
