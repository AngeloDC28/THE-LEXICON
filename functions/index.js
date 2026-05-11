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

    // 2. The Institutional HTML Template (Curatorial Voice)
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
            font-size: 13px;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
          }
          .wrapper {
            background-color: #FAF9F6;
            padding: 40px 20px;
          }
          .container {
            max-width: 540px;
            margin: 0 auto;
            border: 1px solid #000000;
            padding: 32px;
            background-color: #FAF9F6;
          }
          .header {
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            margin-bottom: 32px;
            font-size: 11px;
            border-bottom: 1px solid #000000;
            padding-bottom: 12px;
          }
          p {
            margin-bottom: 24px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .link-container {
            margin: 48px 0;
            text-align: center;
          }
          .link-btn {
            display: inline-block;
            background-color: #000000;
            color: #FAF9F6;
            text-decoration: none;
            padding: 16px 32px;
            border: 1px solid #000000;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            font-size: 11px;
          }
          .link-btn:hover {
            background-color: #FAF9F6;
            color: #000000;
          }
          .footer {
            margin-top: 48px;
            padding-top: 16px;
            border-top: 1px solid rgba(0,0,0,0.1);
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            opacity: 0.6;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">SYSTEM_AUTHENTICATION // THE LEXICON</div>
            
            <p>A request has been made to access your research space within The Lexicon.</p>
            <p>Use the secure link below to return to your Connection Matrix.</p>
            
            <div class="link-container">
              <a href="${authLink}" class="link-btn">[ INITIALIZE SESSION ]</a>
            </div>
            
            <p style="font-size: 10px; opacity: 0.5;">IF YOU DID NOT INITIATE THIS REQUEST, DISREGARD THIS TRANSMISSION.</p>
            
            <div class="footer">
              Relational Database & Cultural Directory<br>
              Institutional Access Protocol v7.2.5
            </div>
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
