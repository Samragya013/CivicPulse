# 🔥 Firebase Authentication Setup Guide

This guide walks you through setting up Firebase Authentication for CivicPulse.

## 📋 Prerequisites

- A Google account
- Access to [Firebase Console](https://console.firebase.google.com/)

---

## 🚀 Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter project name: `CivicPulse` (or your preferred name)
4. (Optional) Enable Google Analytics
5. Click **"Create project"**

---

## 🔑 Step 2: Enable Authentication

1. In your Firebase project, click **"Authentication"** in the left sidebar
2. Click **"Get started"**
3. Go to **"Sign-in method"** tab

### Enable Email/Password

1. Click **"Email/Password"**
2. Toggle **"Enable"**
3. Click **"Save"**

### Enable Google Sign-In (Recommended)

1. Click **"Google"**
2. Toggle **"Enable"**
3. Select a support email
4. Click **"Save"**

---

## 🌐 Step 3: Get Web SDK Configuration

### For Frontend

1. Go to **Project Settings** (⚙️ icon in left sidebar)
2. Scroll to **"Your apps"** section
3. Click the **Web icon** (`</>`)
4. Register your app:
   - App nickname: `CivicPulse Web`
   - (Optional) Set up Firebase Hosting
5. Click **"Register app"**
6. Copy the `firebaseConfig` object

**Update Frontend Configuration:**

Edit `frontend/index.html` and replace the firebaseConfig:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456",
  measurementId: "G-XXXXXXXXXX"
};
```

---

## 🔐 Step 4: Generate Service Account for Backend

### Download Service Account Key

1. Go to **Project Settings** → **Service Accounts** tab
2. Click **"Generate new private key"**
3. Click **"Generate key"** in the confirmation dialog
4. Save the downloaded JSON file securely (e.g., `firebase-adminsdk.json`)

**⚠️ IMPORTANT**: Never commit this file to version control!

### Extract Values for Backend

Open the downloaded JSON file and extract these values:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",              // → FIREBASE_PROJECT_ID
  "private_key_id": "abc123...",                // → FIREBASE_PRIVATE_KEY_ID
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",  // → FIREBASE_PRIVATE_KEY
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",  // → FIREBASE_CLIENT_EMAIL
  "client_id": "123456789",                     // → FIREBASE_CLIENT_ID
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project.iam.gserviceaccount.com"  // → FIREBASE_CLIENT_CERT_URL
}
```

---

## ⚙️ Step 5: Configure Backend Environment

### Create `.env` File

In the `backend/` directory, create a `.env` file:

```bash
cd backend
cp .env.example .env
```

### Edit `.env` File

Open `backend/.env` and add your Firebase credentials:

```env
PORT=5050
NODE_ENV=development

# Firebase Admin SDK Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id-here
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-full-private-key-here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project.iam.gserviceaccount.com
```

**Important Notes:**
- Keep the `\n` characters in `FIREBASE_PRIVATE_KEY`
- Wrap the private key in quotes
- Never commit `.env` to version control (it's in `.gitignore`)

---

## 🧪 Step 6: Test the Setup

### Start the Backend

```bash
cd backend
npm install
npm run dev
```

You should see:
```
[app] Firebase Admin initialized successfully
[server] listening on http://localhost:5050
```

### Test Authentication

1. Open `http://localhost:5050` in your browser
2. Try signing up with:
   - **Google**: Click "Sign up with Google"
   - **Email**: Fill in the signup form
3. After successful signup, you should see the CivicPulse dashboard

---

## 🔒 Security Best Practices

### For Development

1. **Never commit credentials**:
   - `.env` file is in `.gitignore`
   - Service account JSON should never be in the repository

2. **Restrict API keys**:
   - Go to Google Cloud Console
   - Restrict API keys to specific domains/IPs

3. **Use different projects**:
   - Development project for testing
   - Production project for live deployment

### For Production

1. **Set up authorized domains**:
   - Firebase Console → Authentication → Settings
   - Add your production domain

2. **Configure CORS**:
   - Update backend `cors()` settings
   - Restrict to your frontend domain

3. **Use environment variables**:
   - Deploy with environment variables (not `.env` file)
   - Use hosting platform's secrets management

4. **Monitor authentication**:
   - Check Firebase Console → Authentication → Users
   - Review sign-in activity

---

## 🐛 Troubleshooting

### "Firebase Admin not initialized"

**Solution**: Check that all `FIREBASE_*` environment variables are set correctly in `.env`

### "Invalid token" errors

**Solution**: 
1. Ensure frontend `firebaseConfig` matches your project
2. Verify service account credentials in backend `.env`
3. Check that both frontend and backend use the same Firebase project

### Google Sign-in popup blocked

**Solution**:
1. Allow pop-ups in your browser
2. Check browser console for specific error messages
3. Ensure authorized domains are set in Firebase Console

### "Email already in use"

**Solution**: This is expected if you try to sign up twice with the same email. Use the login flow instead.

---

## 📚 Additional Resources

- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [Firebase Admin SDK Setup](https://firebase.google.com/docs/admin/setup)
- [Google OAuth Configuration](https://developers.google.com/identity/protocols/oauth2)

---

## ✅ Verification Checklist

- [ ] Firebase project created
- [ ] Email/Password authentication enabled
- [ ] Google authentication enabled (optional)
- [ ] Frontend `firebaseConfig` updated in `index.html`
- [ ] Service account key downloaded
- [ ] Backend `.env` file created with all Firebase variables
- [ ] Backend starts without errors
- [ ] Can sign up with email/password
- [ ] Can sign up with Google (if enabled)
- [ ] Can login after signup
- [ ] User profile appears in Firebase Console → Authentication

---

**Need help?** Check the main [README.md](README.md) for more information or open an issue on GitHub.
