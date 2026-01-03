# Firebase Email Template Configuration Guide

## Step-by-Step Instructions

This guide walks you through configuring Firebase to send password reset emails with links to your custom password reset page.

### Prerequisites

- Firebase Project created and active
- At least one user registered in your Firebase project
- password-reset.html page deployed to your domain
- Access to Firebase Console

### Step 1: Access Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project from the list
3. In left sidebar, go to **Build** section
4. Click **Authentication**

### Step 2: Access Email Templates

1. From Authentication page, find and click on **Templates** tab (or "Email Templates")
2. You should see a list of template types:
   - Email Verification
   - Password Reset
   - Email Link Sign-in
   - Etc.

### Step 3: Edit Password Reset Template

1. Find and click on **Password Reset** template
2. You'll see three editable sections:
   - Sender name and email
   - Email subject
   - Email body (HTML)
   - Password reset URL

### Step 4: Configure Password Reset URL

**Critical Step:** This tells Firebase where to redirect users who click the reset link.

1. Scroll to the section labeled **Custom action URL** or **Password reset URL**
2. Replace the default URL with your custom password-reset.html page:

   ```
   https://yourdomain.com/password-reset.html
   ```

   **Examples:**
   - `https://codeprac.com/password-reset.html` (Production)
   - `https://dev.codeprac.com/password-reset.html` (Development)
   - `http://localhost:5000/password-reset.html` (Local testing)

3. Click **Save** button at the bottom

### Step 5: Optional - Customize Email Content

You can also customize the email message seen by users:

**Email Subject:**
- Default: "Reset your password"
- Example: "Password Reset Request - CodePrac"

**Email Body:**
The email template uses variables that Firebase replaces:

Common variables:
- `%LINK%` - The password reset link (automatically generated)
- `%EMAIL%` - User's email address
- `%APP_NAME%` - Your app name
- `%DISPLAY_NAME%` - User's display name (if set)

**Example custom HTML:**
```html
<p>Hi %DISPLAY_NAME%,</p>

<p>We received a request to reset the password for your CodePrac account associated with %EMAIL%.</p>

<p><a href="%LINK%">Reset Password</a></p>

<p>If you didn't request this, you can safely ignore this email.</p>

<p>The password reset link expires in 24 hours.</p>

<p>Best regards,<br>The CodePrac Team</p>
```

### Step 6: Verify Configuration

1. After saving, the template should show your custom URL
2. Test by requesting a password reset from your frontend
3. Check your email for the reset link
4. The link should point to your domain (not firebase.com)

## URL Structure

When users click the email link, Firebase appends parameters:

```
https://yourdomain.com/password-reset.html?
  mode=resetPassword
  &oobCode=ABC123DEF456GHI789...
  &continueUrl=https://yourdomain.com/login
  &apiKey=your-api-key-here
  &lang=en
```

**These parameters are:**
- `mode` - Action mode (resetPassword, signIn, etc.)
- `oobCode` - Out-of-Band code (the reset token)
- `continueUrl` - URL to redirect after successful action
- `apiKey` - Firebase API key
- `lang` - Language code

**The password-reset.html page parses these automatically.**

## Verification Checklist

After configuration, verify everything works:

### Email Template Configured
- [ ] Custom URL shows in Firebase Console
- [ ] URL points to your domain (not Firebase)
- [ ] URL ends with `.html` extension (if using .html file)

### Email Sending Works
- [ ] Request password reset from frontend
- [ ] Check email inbox for reset link
- [ ] Email link contains your domain name
- [ ] Email link has `oobCode` parameter

### Email Handler Works
- [ ] Click email link in browser
- [ ] Page loads (no 404 error)
- [ ] Firebase SDK initializes (check console)
- [ ] Reset code verification works
- [ ] Password reset form appears
- [ ] New password can be entered
- [ ] Password validation works
- [ ] Confirm button triggers reset
- [ ] Redirected to login page on success

### Error Handling Works
- [ ] Modify email link to break oobCode
- [ ] Should show error message
- [ ] Doesn't crash or blank page
- [ ] Error message is clear

## Troubleshooting

### Issue: Password reset link doesn't work
**Symptom:** Clicking link shows 404 or blank page

**Check:**
1. URL in Firebase Console is correct
2. Domain/path exists and is accessible
3. password-reset.html file is deployed
4. No typos in URL

**Fix:**
1. Verify file exists at: `yourdomain.com/password-reset.html`
2. Test: Visit URL directly in browser (should load the page)
3. Correct URL in Firebase Console if needed

### Issue: Firebase SDK not loading
**Symptom:** Console error about Firebase undefined

**Check:**
1. password-reset.html has Firebase CDN script
2. Internet connection available
3. API key is correct in HTML file

**Fix:**
```html
<!-- Ensure this line is in password-reset.html -->
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js"></script>
```

### Issue: Error verifying reset code
**Symptom:** "Invalid or expired code" message when clicking link

**Possible causes:**
- Link is older than 24 hours
- User already reset password with this code
- Firebase API key mismatch

**Fix:**
1. Request new password reset email
2. Verify API key in password-reset.html matches Firebase Console
3. Check Firebase Project ID is correct

### Issue: Email not being sent
**Symptom:** No email received after requesting password reset

**Check:**
1. Spam/junk folder
2. Email address is registered in Firebase
3. Firebase email service is enabled

**Fix:**
1. Request again (may take a few moments)
2. Check email address in signup
3. See Firebase Email Service setup below

### Issue: Users redirected to Firebase domain instead of custom page
**Symptom:** Reset links go to `accounts.google.com` instead of your domain

**Fix:**
Firebase Email Template URL not configured or incorrect
1. Go back to Firebase Console
2. Authentication → Templates → Password Reset
3. Verify custom URL is set
4. Check URL is correct
5. Save and test again

## Firebase Email Service Setup

If emails aren't being delivered at all:

### For Gmail Accounts
Firebase uses Gmail automatically - should work out of the box.

### For Custom Domain Email
1. Firebase Console → Project Settings → Authorized Domains
2. Add your domain to authorized list
3. May take 5-10 minutes to propagate

### For Email Quota Issues
- Firebase free tier allows limited emails per day
- Check usage in Firebase Console
- May need to upgrade to Spark/Blaze plan

## Environment-Specific Configuration

### Development
```
Password Reset URL: http://localhost:5000/password-reset.html
```

### Staging
```
Password Reset URL: https://staging.yourdomain.com/password-reset.html
```

### Production
```
Password Reset URL: https://yourdomain.com/password-reset.html
```

**Note:** You may need separate Firebase projects for each environment, or update the URL in Firebase Console when deploying.

## Code Integration

### In password-reset.html

The file already has the logic to:
1. Parse query parameters from Firebase
2. Extract the oobCode
3. Initialize Firebase SDK
4. Call verifyPasswordResetCode()
5. Call confirmPasswordReset()

**You only need to:**
1. Update FIREBASE_API_KEY (if using static API key)
2. Ensure FIREBASE_PROJECT_ID matches your project

### In index.html

The forgot password form is ready to use:
1. User enters email
2. Clicks "Send Reset Email"
3. Backend calls Firebase to generate link
4. Firebase sends email with link from configured template

**No additional code changes needed.**

## Testing Email Delivery

### Manual Test
1. Create test user in Firebase Console
2. Request password reset with that email
3. Check if email arrives
4. Click link and complete reset
5. Try logging in with new password

### Automated Test
```python
# In test_password_reset.py
with patch('firebase_admin.auth.generate_password_reset_link') as mock:
    mock.return_value = 'https://yourdomain.com/password-reset.html?code=ABC123'
    response = client.post('/api/auth/password-reset-request', 
                          json={'email': 'test@example.com'})
    assert response.status_code == 200
```

## Security Considerations

### Email Template Security
- Don't include sensitive information in email body
- Link expires in 24 hours automatically
- Link is single-use only
- Only valid for the intended user

### Domain Security
- Ensure yourdomain.com uses HTTPS
- Reset link should be HTTPS-only
- Configure HSTS headers
- Keep domain SSL certificate up to date

### API Key Security
- API key in password-reset.html is public (it's the web API key)
- Not the same as private admin key
- Only allows password reset, sign in, etc.
- Cannot modify data or delete

## Monitoring & Logs

### View Password Reset Attempts
Firebase Console → Authentication → Audit logs

You can see:
- Who requested password reset
- When it was requested
- Whether reset was successful
- Failed reset attempts

### Track Email Delivery
Check:
- Server logs for backend requests
- Firebase Console for API calls
- Email bounce rates
- User reports of not receiving email

### Set Alerts
Configure alerts for:
- Multiple reset requests from same email
- Multiple reset requests from same IP
- Email delivery failures
- Reset code verification failures

## Next Steps

After configuring email template:

1. **Test End-to-End**
   - Request password reset
   - Verify email delivery
   - Click link and reset password
   - Login with new password

2. **Enable Feature**
   - Frontend forgot password form is ready to use
   - No additional frontend changes needed
   - Form will work once email template is configured

3. **Monitor**
   - Watch for delivery issues
   - Monitor for abuse patterns
   - Check error logs

4. **Support**
   - Train users on password reset process
   - Document process in help section
   - Have recovery process for broken emails

## Common Questions

**Q: How long does password reset link last?**
A: 24 hours. After that, user must request a new link.

**Q: Can users reset someone else's password?**
A: No. Only the registered email address receives the link.

**Q: What happens if user clicks reset link twice?**
A: Second click will show "invalid code" error. They must request a new link.

**Q: Can I customize the email sender name?**
A: Yes, in Firebase Console → Email Template → Sender Name/Email

**Q: What if users never receive the email?**
A: Check:
1. Email address is correct
2. Check spam folder
3. Check email service logs
4. Verify authorized domains in Firebase

**Q: Do I need to modify password-reset.html?**
A: Minimal changes needed:
1. Update FIREBASE_API_KEY if using static key
2. Verify FIREBASE_PROJECT_ID matches your project
3. Update redirect URLs if needed

That's it! The page handles the rest.
