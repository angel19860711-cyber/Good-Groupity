import express from 'express';
import { createServer as createViteServer } from 'vite';
import { google } from 'googleapis';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    '' // Redirect URI will be set per request
  );

  const getRedirectUri = (req: express.Request) => {
    // In AI Studio, we need to handle the proxy header
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    return `${protocol}://${host}/auth/google/callback`;
  };

  // 1. Get Auth URL
  app.get('/api/auth/google/url', (req, res) => {
    try {
      const redirectUri = getRedirectUri(req);
      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file'
        ],
        redirect_uri: redirectUri,
        prompt: 'consent'
      });
      res.json({ url });
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate auth URL' });
    }
  });

  // 2. Auth Callback
  app.get(['/auth/google/callback', '/auth/google/callback/'], async (req, res) => {
    const { code } = req.query;
    const redirectUri = getRedirectUri(req);
    
    try {
      const { tokens } = await oauth2Client.getToken({
        code: code as string,
        redirect_uri: redirectUri
      });
      
      // Store tokens in a cookie
      res.cookie('google_tokens', JSON.stringify(tokens), {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 3600000 // 1 hour
      });

      res.send(`
        <html>
          <head>
            <title>授權成功</title>
            <style>
              body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fff9f5; color: #4a3728; }
              .card { text-align: center; p: 2rem; border-radius: 1rem; border: 2px solid #ffedd5; background: white; padding: 2rem; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>喵嗚！授權成功</h2>
              <p>視窗即將自動關閉，請回到原視窗查看結果。</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                setTimeout(() => window.close(), 1000);
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('OAuth Error:', error);
      res.status(500).send('Authentication failed');
    }
  });

  // 3. Export to Sheets
  app.post('/api/export/sheets', async (req, res) => {
    const tokensStr = req.cookies.google_tokens;
    if (!tokensStr) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const tokens = JSON.parse(tokensStr);
      oauth2Client.setCredentials(tokens);

      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
      const { title, groups } = req.body;

      // Create a new spreadsheet
      const spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title }
        }
      });

      const spreadsheetId = spreadsheet.data.spreadsheetId!;
      
      // Prepare data
      const values = [['組別名稱', '成員姓名']];
      groups.forEach((group: any) => {
        group.members.forEach((member: string) => {
          values.push([group.name, member]);
        });
      });

      // Append data
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'RAW',
        requestBody: { values }
      });

      res.json({ spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` });
    } catch (error) {
      console.error('Sheets Export Error:', error);
      res.status(500).json({ error: 'Export failed' });
    }
  });

  // Vite setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
