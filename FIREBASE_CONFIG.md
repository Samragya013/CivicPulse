# 🔥 Firebase Configuration Quick Reference

## Frontend Configuration (index.html)

Update the `firebaseConfig` object in `frontend/index.html` (around line 16):

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
  measurementId: "G-XXXXXXXXXX"
};
```

**Where to find these values:**
- Firebase Console → Project Settings → General → Your apps → Web app

---

## Backend Configuration (.env file)

Create `backend/.env` with these variables:

```env
PORT=5050
NODE_ENV=development

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=abc123...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/...
```

**Where to find these values:**
- Firebase Console → Project Settings → Service Accounts → Generate new private key
- Extract values from the downloaded JSON file

---

## Quick Setup Commands

```bash
# Install backend dependencies
cd backend
npm install

# Start development server
npm run dev

# Server runs on http://localhost:5050
```

---

## Environment Variables Mapping

| JSON Key (Service Account) | .env Variable |
|----------------------------|---------------|
| `project_id` | `FIREBASE_PROJECT_ID` |
| `private_key_id` | `FIREBASE_PRIVATE_KEY_ID` |
| `private_key` | `FIREBASE_PRIVATE_KEY` |
| `client_email` | `FIREBASE_CLIENT_EMAIL` |
| `client_id` | `FIREBASE_CLIENT_ID` |
| `client_x509_cert_url` | `FIREBASE_CLIENT_CERT_URL` |

---

## Important Notes

⚠️ **Security**
- Never commit `.env` to version control
- Keep service account JSON file secure
- Use different projects for dev/production

⚠️ **Private Key Format**
- Keep the `\n` newline characters
- Wrap in double quotes
- Example: `"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"`

⚠️ **Firebase Console Setup**
1. Enable Authentication
2. Enable Email/Password provider
3. Enable Google provider (optional)
4. Add authorized domains for production

---

## Testing

After configuration:

1. Start server: `npm run dev`
2. Open: `http://localhost:5050`
3. Try signup/login
4. Check console for errors

**Expected console output:**
```
[app] Firebase Admin initialized successfully
[server] listening on http://localhost:5050
```

---

For detailed setup instructions, see [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
