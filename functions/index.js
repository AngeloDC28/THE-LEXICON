const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Configure the email transport using Nodemailer.
// Replace 'gmail' and credentials with your preferred SMTP service (e.g., Resend, SendGrid).
const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER || 'dummy@example.com',
    pass: process.env.EMAIL_PASS || 'dummy-pass'
  }
});

exports.sendCustomMagicLink = functions.https.onCall(async (data, context) => {
  const email = data.email;
  
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with an "email" argument.');
  }

  // Set the redirection URL to the correct lexicon-7575c authorized domain.
  const actionCodeSettings = {
    url: 'https://lexicon-7575c.web.app/', // Change to your exact live domain if using a custom one
    handleCodeInApp: true,
  };

  try {
    // 1. Generate the secure authentication URL programmatically
    const authLink = await admin.auth().generateSignInWithEmailLink(email, actionCodeSettings);

    // 2. The Acid Brutalist HTML Template (Curatorial Voice)
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            background-color: #FAF9F6;
            color: #000000;
            font-family: 'IBM Plex Mono', 'Courier New', Courier, monospace;
            font-size: 14px;
            line-height: 1.6;
            margin: 0;
            padding: 40px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            border: 1px solid #000000;
            padding: 30px;
            background-color: #FAF9F6;
          }
          .title {
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            border-bottom: 1px solid #000000;
            padding-bottom: 10px;
            margin-bottom: 30px;
          }
          p {
            margin-bottom: 20px;
          }
          .btn-container {
            margin: 40px 0;
          }
          .btn {
            display: inline-block;
            background-color: #000000;
            color: #FAF9F6;
            text-decoration: none;
            padding: 12px 24px;
            border: 1px solid #000000;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-radius: 0;
          }
          .btn:hover {
            background-color: #FAF9F6;
            color: #000000;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #000000;
            font-size: 11px;
            opacity: 0.7;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="title">The Lexicon — Secure Access</div>
          
          <p>A request has been made to access your research space within The Lexicon.</p>
          <p>Use the secure link below to authenticate your session and return to your Connection Matrix.</p>
          
          <div class="btn-container">
            <a href="${authLink}" class="btn">AUTHENTICATE SESSION</a>
          </div>
          
          <p>If you did not initiate this request, please disregard this message.</p>
          
          <div class="footer">
            The Lexicon | Visual Culture Archive
          </div>
        </div>
      </body>
      </html>
    `;

    // 3. Send the custom email
    const mailOptions = {
      from: '"The Lexicon" <noreply@thelexicon.archive>',
      to: email,
      subject: 'The Lexicon — Secure Access',
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);

    return { success: true, message: 'Institutional authentication email delivered.' };
  } catch (error) {
    console.error('Error generating/sending custom magic link:', error);
    throw new functions.https.HttpsError('internal', 'Unable to execute authentication protocol.');
  }
});
