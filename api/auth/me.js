import { getUserFromRequest } from '../../lib/session.js';

export default async function handler(req, res) {
  try {
    const user = await getUserFromRequest(req);
    return res.status(200).json({ user: user ? { email: user.email } : null });
  } catch (e) {
    console.error('[auth/me]', e);
    return res.status(200).json({ user: null });
  }
}
