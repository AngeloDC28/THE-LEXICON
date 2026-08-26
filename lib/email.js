import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMagicLink(email, rawToken, next = '/') {
  const origin = process.env.APP_ORIGIN || 'https://thelexicon.xyz';
  const link = `${origin}/api/auth/verify?token=${rawToken}&next=${encodeURIComponent(next)}`;

  const { error } = await resend.emails.send({
    from: 'THE LEXICON <signin@thelexicon.xyz>',
    to: email,
    subject: 'Your sign-in link for THE LEXICON',
    text: `Sign in to THE LEXICON.\n\nClick to sign in (expires in 15 minutes, one-time use):\n\n${link}\n\nDidn't request this? Ignore this email — no action will be taken.\n\n— THE LEXICON`,
    html: `<div style="font-family:ui-monospace,'IBM Plex Mono',monospace;background:#0d0d0d;color:#e8e6e3;padding:40px 32px;max-width:480px;margin:0 auto">
  <p style="font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:#a8a5a0;margin:0 0 32px">THE LEXICON</p>
  <h1 style="font-size:14px;letter-spacing:.1em;text-transform:uppercase;margin:0 0 16px;font-weight:700">[ SIGN IN ]</h1>
  <p style="font-size:13px;line-height:1.7;color:#cfcdc7;margin:0 0 8px">Click below to sign in. This link expires in <strong style="color:#e8e6e3">15 minutes</strong> and can be used once.</p>
  <p style="font-size:12px;color:#8a8a8a;margin:0 0 32px">No password. We store only your email.</p>
  <p style="margin:0 0 40px"><a href="${link}" style="display:inline-block;padding:12px 24px;background:#ccff00;color:#000;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">[ SIGN IN TO THE LEXICON ]</a></p>
  <p style="font-size:11px;color:#666;line-height:1.6;border-top:1px solid #222;padding-top:20px;margin:0">Didn't request this? Ignore this email — no action will be taken and your address won't be stored if you've never signed in before.</p>
</div>`,
  });

  if (error) throw new Error(`Email send failed: ${error.message}`);
}
