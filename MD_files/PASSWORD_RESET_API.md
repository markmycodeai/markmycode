# Password Reset Feature - API Documentation

## Overview

The password reset feature enables users to securely reset their forgotten passwords through an email-based verification flow. The feature integrates Firebase Admin SDK (backend) with Firebase Client SDK (frontend) to provide a seamless password recovery experience.

## Architecture

### Components

1. **Frontend Form** (`index.html`)
   - User-facing form to request password reset
   - Located in login modal
   - Collects user email address

2. **Email Action Handler** (`password-reset.html`)
   - Custom page served by Firebase after user clicks email link
   - Validates reset code
   - Collects and validates new password
   - Confirms password reset

3. **Backend Endpoint** (`/api/auth/password-reset-request`)
   - Validates email format
   - Generates password reset link via Firebase
   - Sends email to user
   - Logs audit trail

4. **Auth Module** (`js/auth.js`, `auth.py`)
   - Frontend: `requestPasswordReset(email)` - Calls backend
   - Backend: `send_password_reset_email()` - Utility function

## API Endpoints

### POST /api/auth/password-reset-request

**Request Password Reset Email**

Request a password reset email for a given email address.

#### Request

```
POST /api/auth/password-reset-request
Content-Type: application/json

{
    "email": "user@example.com"
}
```

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | User email address. Must be valid email format. |

#### Response - Success (200)

```json
{
    "error": false,
    "message": "Password reset email sent successfully",
    "data": {
        "message": "Check your email for password reset instructions",
        "reset_link_preview": "https://example.com/password-reset.html?mode=resetPassword&oobCode=ABC123..."
    }
}
```

#### Response - Invalid Email Format (400)

```json
{
    "error": true,
    "code": "INVALID_EMAIL",
    "message": "Invalid email format"
}
```

#### Response - Missing Email (400)

```json
{
    "error": true,
    "code": "INVALID_INPUT",
    "message": "email is required"
}
```

#### Response - Email Service Error (500)

```json
{
    "error": true,
    "code": "EMAIL_ERROR",
    "message": "Failed to send password reset email. Please try again later."
}
```

#### Response - Non-existent Email (200)

**Important**: Returns success even if email doesn't exist (security best practice - doesn't reveal user existence)

```json
{
    "error": false,
    "message": "If an account with this email exists, you will receive a password reset link",
    "data": {}
}
```

#### Implementation Details

- **Email Validation**: Uses regex pattern `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
- **Reset Link Generation**: Uses `firebase_admin.auth.generate_password_reset_link()`
- **Audit Logging**: All password reset requests are logged via `audit_log()`
- **Security**: Endpoint doesn't reveal whether email exists or is registered

#### Example cURL Request

```bash
curl -X POST http://localhost:5000/api/auth/password-reset-request \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

#### Example JavaScript Request

```javascript
const response = await fetch('/api/auth/password-reset-request', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        email: document.getElementById('forgotEmail').value
    })
});

const data = await response.json();
if (!data.error) {
    console.log('Password reset email sent');
} else {
    console.error('Error:', data.message);
}
```

## Firebase Client-Side Flow

### Password Reset Page (password-reset.html)

The password-reset.html page handles the actual password reset process using Firebase Client SDK.

#### Query Parameters

Firebase appends these query parameters to the reset link:

| Parameter | Description |
|-----------|-------------|
| mode | Action mode (e.g., "resetPassword") |
| oobCode | Out-of-band reset code |
| continueUrl | URL to redirect after successful reset |
| lang | Language code for email template |
| apiKey | Firebase API key |

#### Client-Side Methods

##### verifyPasswordResetCode(auth, actionCode)

Verifies the reset code is valid and returns the user's email.

```javascript
firebase.auth().verifyPasswordResetCode(actionCode)
    .then((email) => {
        console.log('Valid reset code for:', email);
        // Show password reset form
    })
    .catch((error) => {
        // Handle invalid/expired code
    });
```

##### confirmPasswordReset(auth, actionCode, newPassword)

Confirms the new password and completes the reset.

```javascript
firebase.auth().confirmPasswordReset(actionCode, newPassword)
    .then(() => {
        console.log('Password reset successful');
        // Redirect to login
    })
    .catch((error) => {
        // Handle password reset error
    });
```

## Frontend Integration

### Form Submission Flow (index.html)

1. User enters email in forgot password form
2. User clicks "Send Reset Email" button
3. JavaScript calls `Auth.requestPasswordReset(email)`
4. Shows loading spinner while request is in progress
5. On success:
   - Shows success message with email confirmation
   - Auto-redirects to login after 5 seconds
6. On error:
   - Shows error message
   - User can retry

### Form Elements

```html
<!-- Email Input -->
<input type="email" id="forgotEmail" placeholder="Email address" />

<!-- Submit Button -->
<button id="forgotPasswordBtn">Send Reset Email</button>

<!-- Loading State -->
<div id="forgotLoadingState" class="hidden">
    <p>Sending reset link to your email...</p>
</div>

<!-- Success Message -->
<div id="forgotSuccessMessage" class="hidden">
    Check your email for reset instructions
</div>

<!-- Error Message -->
<div id="forgotErrorMessage" class="hidden"></div>
```

### JavaScript Handler

```javascript
Auth.requestPasswordReset(email)
    .then(response => {
        if (!response.error) {
            showSuccessMessage();
            redirectToLoginAfter(5000);
        } else {
            showErrorMessage(response.message);
        }
    })
    .catch(error => {
        showErrorMessage('Failed to send reset link');
    });
```

## Error Handling

### Backend Error Codes

| Code | HTTP Status | Description | Action |
|------|-------------|-------------|--------|
| INVALID_INPUT | 400 | Email parameter missing | Provide email |
| INVALID_EMAIL | 400 | Email format invalid | Correct email format |
| EMAIL_ERROR | 500 | Email service failed | Retry later |
| (None) | 200 | Non-existent email (no error) | N/A |

### Frontend Error Codes

Error codes in `password-reset.html`:

| Code | Description | User Action |
|------|-------------|-------------|
| invalid-action-code | Reset code expired or invalid | Request new reset email |
| user-disabled | User account is disabled | Contact support |
| user-not-found | User not found | Check email or register |
| weak-password | Password doesn't meet requirements | Use stronger password |
| operation-not-allowed | Password reset disabled | Contact support |
| (Generic) | Unexpected error | Retry or contact support |

## Password Validation

### Client-Side Password Requirements (password-reset.html)

Password must meet these criteria:

1. **Minimum Length**: 8 characters
2. **Uppercase Letter**: At least one A-Z
3. **Lowercase Letter**: At least one a-z
4. **Number**: At least one 0-9
5. **Special Character**: At least one `!@#$%^&*`

### Password Strength Indicator

Real-time feedback as user types:

- **Weak** (Red): 1-2 requirements met
- **Medium** (Yellow): 3 requirements met
- **Strong** (Green): 4+ requirements met

## Security Considerations

### Best Practices Implemented

1. **Email Existence**: Endpoint doesn't reveal if email exists (prevents user enumeration)
2. **Rate Limiting**: Should be added via Redis/cache in production
3. **HTTPS**: All password reset links use HTTPS
4. **Secure Code**: Reset codes are single-use and expire after 24 hours
5. **No Password Storage**: Reset codes never stored in application
6. **Audit Logging**: All password reset requests logged for security review
7. **CORS Support**: Endpoint supports CORS preflight requests

### Recommendations for Production

1. **Implement Rate Limiting**
   ```python
   from flask_limiter import Limiter
   
   limiter = Limiter(app, key_func=lambda: request.remote_addr)
   
   @auth_bp.route("/password-reset-request", methods=["POST"])
   @limiter.limit("5 per hour")
   def request_password_reset():
       ...
   ```

2. **Monitor Abuse**
   - Alert on multiple reset requests from same email
   - Alert on multiple reset requests from same IP

3. **Verify Email Ownership**
   - Consider adding CAPTCHA for password reset form
   - Implement account recovery questions for verification

4. **Test Reset Link Validity**
   - Monitor failed reset attempts
   - Alert users of suspicious activity

## Firebase Configuration

### Email Template Setup

1. Go to Firebase Console → Authentication → Templates
2. Select "Password reset" template
3. Update "Password reset URL" to point to custom handler:
   ```
   https://yourdomain.com/password-reset.html
   ```

4. Customize email template as needed:
   - Subject line
   - Body content
   - Action button text
   - Footer/branding

### Environment Variables

Required in `config.py` or `.env`:

```python
FIREBASE_API_KEY = "your-firebase-api-key"
FIREBASE_PROJECT_ID = "your-project-id"
FIREBASE_AUTH_DOMAIN = "your-project.firebaseapp.com"
```

## Testing

### Unit Tests

Run the comprehensive test suite:

```bash
python test_password_reset.py
```

Tests cover:
- Valid email password reset
- Missing email parameter
- Invalid email format
- Non-existent user email
- Email service errors
- CORS preflight requests
- Email validation
- Security (SQL injection, rate limiting)
- Audit logging
- Frontend integration

### Manual Testing

1. **Request Reset Email**
   ```bash
   curl -X POST http://localhost:5000/api/auth/password-reset-request \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```

2. **Check Email**
   - Look for email from Firebase/your domain
   - Click password reset link

3. **Enter New Password**
   - Enter new password (must meet requirements)
   - Check password strength indicator
   - Click "Confirm" button

4. **Verify Success**
   - Should be redirected to login page
   - Should see success message
   - Login with new password should work

## Troubleshooting

### Emails Not Being Sent

**Check:**
1. Firebase project has valid SMTP/email service configured
2. Email address is valid
3. User account exists in Firebase
4. Server logs show no errors

**Solution:**
```python
# Check Firebase Admin SDK is initialized
from firebase_init import get_auth
print(get_auth().get_user('uid-here'))
```

### Reset Link Invalid/Expired

**Common Causes:**
- Link is older than 24 hours
- User already reset password with this code
- Firebase project changed

**Solution:**
- User requests new password reset email
- Check Firebase project ID in password-reset.html matches

### Password Validation Failing

**Check:**
- Password meets all 5 requirements
- No extra whitespace in password

**Show Requirements:**
The password-reset.html page displays requirements in real-time as user types.

### CORS Errors

**Check:**
- Browser console for CORS error messages
- Ensure password-reset.html is served from same domain as main app

**Solution:**
Add CORS headers in Flask:
```python
from flask_cors import CORS
CORS(app)
```

## API Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-03 | Initial implementation with Firebase integration |

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review Firebase console authentication logs
3. Check server logs for detailed error messages
4. Contact development team with error details
