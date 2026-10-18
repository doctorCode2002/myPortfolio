# Guestbook and visitor ghosts

The 3D world (`/play`) has two small social features backed by the Supabase project
**portfolio-world** (`https://xaqrvefokpflahxhxusy.supabase.co`):

- **Visitor ghosts**: other people exploring at the same time show up as translucent
  versions of their chosen character. Positions travel over a Realtime channel called
  `world` (Broadcast for positions, Presence only for the roster). Nothing is stored.
- **Guestbook**: the stone on the home plaza (next to the notice board) lets visitors
  leave a message. Messages are stored in `public.guestbook_messages` and stay hidden
  until you approve them; approved ones are listed on the notice board's "Guestbook" tab
  (the latest 20).

The client lives in `lib/social/` (config, client, validation, error mapping), the 3D parts
in `components/game3d/social/` and the panels in `components/game/social-ui/`. The site
uses the **publishable** key only (public by design); row-level security lets the anon role
insert pending messages and read approved ones (columns `id, name, message, locale, island,
created_at` only). There is deliberately no admin UI in the site: moderation happens in
Supabase with your own login.

## Approving messages

### In the dashboard (Table editor)

1. Open the Supabase dashboard and pick the **portfolio-world** project.
2. Go to **Table Editor** and open `guestbook_messages`.
3. Sort or filter by `approved = false` to see the pending messages.
4. Double-click the `approved` cell of a message, set it to `true`, and save.

The message appears on the notice board the next time someone opens the Guestbook tab.
To hide it again, set `approved` back to `false`. To remove spam, delete the row.

### With SQL (SQL editor)

List the pending messages:

```sql
select id, name, message, locale, island, created_at
from public.guestbook_messages
where approved = false
order by created_at desc;
```

Approve one:

```sql
update public.guestbook_messages set approved = true where id = '...';
```

Approve several at once:

```sql
update public.guestbook_messages
set approved = true
where id in ('...', '...');
```

Delete one:

```sql
delete from public.guestbook_messages where id = '...';
```

## What the database enforces

- `name` 1-40 characters, `message` 1-240, `locale` is `en` or `ar`.
- A trigger forces new rows to `approved = false`, trims the text, sets `created_at`, and
  stores a hashed sender id (SHA-256 of the request IP plus a salt, never the IP itself).
- Rate limit: 3 messages per sender per 10 minutes (and 30 per minute overall). The
  trigger raises `rate_limited`, which the panel turns into a friendly "please wait".

## Privacy

- Guestbook: the name and message the visitor types, the language, the island, the time,
  and the hashed sender id for rate limiting. This is said in the panel.
- Ghosts: a random per-tab id, the picked character, island, position, heading and
  movement mode. Nothing is stored. Visitors can turn ghosts off ("Show other visitors")
  and stop sending their own position ("Share my position") from the "Visitors" button;
  the choice is remembered in localStorage.

## Configuration and failure

`lib/social/config.ts` reads `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (defaults are the values above). `supabase-js` is
loaded with a dynamic import about 1.5 s after the world appears. If Supabase is paused or
unreachable, there are no ghosts, the Guestbook tab says it can't be reached, and the rest
of the game works unchanged.

Free-tier note: Realtime counts each delivered message. Each moving visitor sends at most
4 updates per second (one every 5 s while idle, none while the tab is hidden), and every
other connected visitor receives them.
