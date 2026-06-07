import { sql } from '../../lib/db.js';
import { getUserFromRequest } from '../../lib/session.js';

// POST /api/folders/entry  { folderId, entrySlug }  — add entry to folder
// DELETE /api/folders/entry  { folderId, entrySlug }  — remove entry from folder
export default async function handler(req, res) {
  const user = await getUserFromRequest(req).catch(() => null);
  if (!user) return res.status(401).json({ error: 'not_authenticated' });

  const { folderId, entrySlug } = req.body || {};
  if (!folderId || !entrySlug) {
    return res.status(400).json({ error: 'missing_params' });
  }

  // Verify folder belongs to user
  const folders = await sql`
    select id from folders where id = ${folderId} and user_id = ${user.id}`;
  if (!folders[0]) return res.status(404).json({ error: 'folder_not_found' });

  if (req.method === 'POST') {
    await sql`
      insert into folder_entries (folder_id, entry_slug)
      values (${folderId}, ${entrySlug})
      on conflict (folder_id, entry_slug) do nothing`;
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await sql`
      delete from folder_entries
      where folder_id = ${folderId} and entry_slug = ${entrySlug}`;
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
