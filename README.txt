DATHKAINE FORUM - ADMIN/MODERATOR BUILD
Run: npm install
Run: npm start
Open: http://localhost:3001

The first newly registered account becomes admin. Later accounts are members.
Admin: change user roles; all moderator controls.
Moderator: pin/unpin, lock/unlock, delete threads, delete replies.

For public deployment, set SESSION_SECRET and replace the default in-memory session store with a persistent store.
