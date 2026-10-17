# Atlas migration completed

The application now uses MongoDB Atlas, database university_connect. Migration completed on 2026-10-17.

- 52 users and 21 collections transferred.
- All imported document contents verified against the BSON snapshot.
- Original indexes preserved and checked.
- API health, administrator login, authenticated profile, dashboard (52 users) and newsfeed returned HTTP 200.
- Existing account passwords and email-verification states preserved.

Private configuration: .env (running application) and .env.atlas (Atlas credentials). Both are ignored by Git. Never include either in source archives or messages.

Private pre-migration snapshot: .local-data/atlas-cutover.backup.json. Keep it private: it includes account data and password hashes.

Startup after the current processes are stopped:

    npm run dev

Use the normal server, which reads MONGODB_URI from .env. Do not use npm run dev:local: that command creates a different temporary database. Do not run seed on the migrated database.

The complete application, node_modules and private configuration now live together in this project folder. The app is started from this folder with npm run dev. The package layout does not require workspace junctions, including on FAT32 USB drives.

MongoDB Compass: New Connection, use the private MONGODB_URI value from .env.atlas. Data is in university_connect. The former 127.0.0.1:8410 connection is no longer the application's database.

Atlas Network Access must allow the application host's outbound IP. Database Access must grant readWrite on university_connect. Never disable TLS certificate validation to work around connection errors.

The server uses a persistent JWT_SECRET now; the one-time switch from the temporary server requires users with older cookies to sign in again.
