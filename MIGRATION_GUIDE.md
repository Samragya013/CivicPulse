# 📦 Migration Guide: JWT to Firebase Authentication

This guide helps you migrate existing CivicPulse users from JWT-based authentication to Firebase Authentication.

---

## ⚠️ Important Notes

### Breaking Change
The authentication system has been completely replaced. **Existing JWT tokens will no longer work.**

### User Impact
- Existing users must create new accounts
- User data (name, email, role) can be preserved
- Incident and poll data remains intact

---

## 🔄 Migration Options

### Option 1: Simple Migration (Users Re-register)

**Recommended for:** Small user bases, development/testing

**Process:**
1. Deploy Firebase authentication
2. Notify users of the change
3. Users create new accounts with same email
4. Admin assigns roles as needed

**Pros:**
- Simple to implement
- Clean slate
- No data migration needed

**Cons:**
- Users must re-register
- Temporary disruption

---

### Option 2: Automated Migration (Preserve User Data)

**Recommended for:** Production deployments with existing users

**Process:**
1. Create Firebase users programmatically
2. Update backend user records with Firebase UIDs
3. Notify users to reset passwords

**Implementation Steps:**

#### Step 1: Install Firebase Admin in Migration Script

```bash
npm install firebase-admin
```

#### Step 2: Create Migration Script

Create `backend/scripts/migrate-users.js`:

```javascript
import { promises as fs } from 'fs';
import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  await fs.readFile('./firebase-service-account.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function migrateUsers() {
  // Read old users.json
  const usersPath = path.join(__dirname, '../data/users.json');
  const usersData = await fs.readFile(usersPath, 'utf8');
  const users = JSON.parse(usersData);

  const migratedUsers = [];
  const errors = [];

  for (const user of users) {
    try {
      console.log(`Migrating user: ${user.email}`);

      // Create Firebase user with email only (password reset required)
      const firebaseUser = await admin.auth().createUser({
        email: user.email,
        emailVerified: false,
        displayName: user.name
      });

      // Update user record with Firebase UID
      const updatedUser = {
        ...user,
        firebase_uid: firebaseUser.uid,
        migrated_at: new Date().toISOString(),
        // Remove old password hash
        password_hash: undefined
      };

      migratedUsers.push(updatedUser);

      console.log(`✅ Migrated: ${user.email} → ${firebaseUser.uid}`);

      // Generate password reset link
      const resetLink = await admin.auth().generatePasswordResetLink(user.email);
      console.log(`Password reset link: ${resetLink}`);

    } catch (error) {
      console.error(`❌ Error migrating ${user.email}:`, error.message);
      errors.push({ email: user.email, error: error.message });
    }
  }

  // Save updated users
  await fs.writeFile(
    usersPath,
    JSON.stringify(migratedUsers, null, 2),
    'utf8'
  );

  // Save migration report
  const report = {
    timestamp: new Date().toISOString(),
    total: users.length,
    migrated: migratedUsers.length,
    errors: errors
  };

  await fs.writeFile(
    path.join(__dirname, '../data/migration-report.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );

  console.log('\n📊 Migration Summary:');
  console.log(`Total users: ${users.length}`);
  console.log(`Migrated: ${migratedUsers.length}`);
  console.log(`Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n❌ Failed migrations:');
    errors.forEach(e => console.log(`  - ${e.email}: ${e.error}`));
  }

  console.log('\n✅ Migration complete!');
  console.log('Next steps:');
  console.log('1. Review migration-report.json');
  console.log('2. Send password reset emails to users');
  console.log('3. Update backend .env with Firebase credentials');
  console.log('4. Deploy new authentication system');
}

migrateUsers().catch(console.error);
```

#### Step 3: Run Migration

```bash
# From backend directory
node scripts/migrate-users.js
```

#### Step 4: Notify Users

Send email to all users:

```
Subject: CivicPulse Account Migration

Dear CivicPulse User,

We've upgraded our authentication system for better security and features!

Your account has been migrated, but you'll need to set a new password:
[Password Reset Link]

New features:
✅ Sign in with Google
✅ Enhanced security
✅ Better account management

Questions? Reply to this email.

Thanks,
The CivicPulse Team
```

---

## 📧 Email Templates

### Password Reset Email

```
Subject: Reset Your CivicPulse Password

Hi [Name],

We've upgraded CivicPulse with new authentication features!

To continue using your account, please set a new password:

[Reset Password Link]

This link expires in 24 hours.

New features:
• Sign in with Google
• Enhanced security
• Profile management

Need help? Contact support.

Best regards,
CivicPulse Team
```

### Welcome Email (New System)

```
Subject: Welcome to the New CivicPulse!

Hi [Name],

Your CivicPulse account is ready!

✅ Email: [email]
✅ Role: [Citizen/Responder]

Sign in now: https://civicpulse.app

New features:
• Google Sign-in
• Enhanced security
• Profile management
• Better incident tracking

Questions? We're here to help!

Best,
CivicPulse Team
```

---

## 🧪 Testing Migration

### Pre-Migration Checklist
- [ ] Backup `backend/data/users.json`
- [ ] Test migration script with sample data
- [ ] Verify Firebase project is set up
- [ ] Test password reset flow
- [ ] Prepare user notification emails

### Post-Migration Checklist
- [ ] Verify all users migrated successfully
- [ ] Check migration-report.json for errors
- [ ] Test login with migrated accounts
- [ ] Verify user roles are preserved
- [ ] Send password reset emails
- [ ] Monitor for user issues

---

## 🔧 Rollback Plan

If migration fails:

1. **Restore Old Users File**
   ```bash
   cp backend/data/users.json.backup backend/data/users.json
   ```

2. **Revert Code Changes**
   ```bash
   git revert <migration-commit-hash>
   ```

3. **Restore Environment**
   - Update `.env` with old `JWT_SECRET`
   - Remove Firebase credentials

4. **Redeploy Old System**
   ```bash
   npm install
   npm run dev
   ```

---

## 💡 Best Practices

### Communication
- Notify users 1 week in advance
- Send multiple reminders
- Provide clear instructions
- Offer support contact

### Timing
- Schedule during low-traffic period
- Allow 24-48 hours for user response
- Have support team ready

### Security
- Force password reset for all users
- Enable email verification in Firebase
- Monitor for suspicious activity
- Review security rules in Firebase Console

---

## 📊 Migration Metrics to Track

- Total users migrated
- Failed migrations
- Password reset completion rate
- Support tickets
- Login success rate
- Time to complete migration

---

## 🆘 Troubleshooting

### "Email already exists" Error

**Cause:** User already signed up with Firebase

**Solution:**
1. Link existing Firebase user to backend profile
2. Or skip user in migration (they're already set up)

### "Invalid email" Error

**Cause:** Email format doesn't match Firebase requirements

**Solution:**
1. Validate and clean email addresses
2. Manually create accounts for invalid emails
3. Contact users for correct email

### Users Can't Reset Password

**Cause:** Email not verified in Firebase

**Solution:**
1. Resend password reset link
2. Verify email in Firebase Console
3. Check email delivery logs

---

## 📚 Additional Resources

- [Firebase Auth Migration](https://firebase.google.com/docs/auth/custom-migrate)
- [Firebase User Management](https://firebase.google.com/docs/auth/admin/manage-users)
- [Firebase Email Templates](https://firebase.google.com/docs/auth/custom-email-handler)

---

## ✅ Success Criteria

Migration is successful when:
- [ ] All users can log in with new system
- [ ] User roles are preserved
- [ ] No data loss
- [ ] Users can reset passwords
- [ ] Google Sign-in works
- [ ] Support tickets are minimal
- [ ] System is stable

---

**Need help with migration?** Open an issue on GitHub or contact support.
