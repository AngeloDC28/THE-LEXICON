import { sql } from '../../lib/db.js';
import { getUserFromRequest } from '../../lib/session.js';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req).catch(() => null);
  if (!user) return res.status(401).json({ error: 'not_authenticated' });

  if (req.method === 'GET') {
    const folders = await sql`
      select f.id, f.name, f.created_at,
             coalesce(json_agg(fe.entry_slug order by fe.created_at) filter (where fe.id is not null), '[]') as entries
      from folders f
      left join folder_entries fe on fe.folder_id = f.id
      where f.user_id = ${user.id}
      group by f.id
      order by f.created_at desc`;
    return res.status(200).json({ folders });
  }

  if (req.method === 'POST') {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'invalid_name' });
    }
    const rows = await sql`
      insert into folders (user_id, name) values (${user.id}, ${name.trim().toUpperCase()})
      returning id, name, created_at`;
    return res.status(201).json({ folder: { ...rows[0], entries: [] } });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
