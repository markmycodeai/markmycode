# Password Reset Feature - Troubleshooting: UI Not Changing

## Issue Fixed ✅

**Problem:** When clicking "Forgot password?", the UI doesn't change and no request is sent to the backend.

**Root Cause:** The API endpoint path was missing the `/api` prefix.

**Solution Applied:**

### 1. Fixed Auth Module (js/auth.js)
Changed:
```javascript
// BEFORE (WRONG)
Utils.apiRequest('/auth/password-reset-request', {...})

// AFTER (CORRECT)
Utils.apiRequest('/api/auth/password-reset-request', {...})
```

### 2. Removed Conflicting Event Listener (js/ui.js)
Removed the back-to-login event listener that could interfere with the form toggle.

### 3. Added Debug Logging
Added console.log statements to `handleForgotPasswordRequest()` method to help debug any issues.

---

## How It Should Work Now

### Step 1: Click "Forgot password?" Link
- UI toggles to show forgot password form
- Login form hides
- Focus moves to email input

### Step 2: Enter Email and Click "Send Reset Email"
In browser console, you should see:
```
[Forgot Password] Email entered: user@example.com
[Forgot Password] Sending request to backend...
```

### Step 3: Backend Response
You should see one of:
```
[Forgot Password] Backend response: {error: false, message: "..."}
[Forgot Password] Error: Failed to send reset link...
```

### Step 4: Success
- Loading spinner disappears
- Success message appears
- Auto-redirects to login after 5 seconds

---

## Testing the Fix

### 1. Open Browser Developer Tools
Press **F12** or **Ctrl+Shift+I** and go to **Console** tab

### 2. Click "Forgot password?" 
- You should see the form toggle to the forgot password form
- Email input should be focused

### 3. Enter Test Email
```
example@test.com
```

### 4. Click "Send Reset Email"
Watch the console for debug messages:
```
[Forgot Password] Email entered: example@test.com
[Forgot Password] Sending request to backend...
```

### 5. Check for Response
You should see either:
- **Success:** `[Forgot Password] Backend response: {...}`
- **Error:** `[Forgot Password] Error: ...` with error message

### 6. Check Network Tab
In Developer Tools → **Network** tab, you should see:
- **Request:** `POST /api/auth/password-reset-request`
- **Status:** 200 (success) or 400/500 (error)

---

## Common Issues & Solutions

### Issue: Form doesn't toggle to forgot password
**Check:**
1. Browser console for JavaScript errors
2. The "Forgot password?" link has `onclick` handler
3. Form elements exist with correct IDs

**Solution:**
```javascript
// Test in console
document.getElementById('loginForm').classList.add('hidden');
document.getElementById('forgotPasswordForm').classList.remove('hidden');
```

### Issue: Console shows "Email entered" but no backend request
**Check:**
1. Email field is not empty
2. Network tab shows request being sent
3. Backend is running (Flask server)

**Solution:**
```javascript
// Test in console
const email = document.getElementById('forgotEmail').value;
console.log('Email value:', email);
```

### Issue: Backend request fails with 404
**Check:**
1. Backend route exists: `/api/auth/password-reset-request`
2. Correct HTTP method: POST
3. Flask app is running

**Solution:**
```bash
# Check if Flask is running on correct port
curl -X POST http://localhost:5000/api/auth/password-reset-request \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Issue: Backend request fails with CORS error
**Check:**
1. Backend has CORS enabled
2. Frontend is on different origin
3. Authorization headers are correct

**Solution:**
Add CORS support in Flask:
```python
from flask_cors import CORS
CORS(app)
```

---

## Manual Testing Checklist

- [ ] Click "Forgot password?" link
- [ ] See forgot password form appear
- [ ] Login form hidden
- [ ] Enter email address
- [ ] Click "Send Reset Email" button
- [ ] See "Sending..." state on button
- [ ] See loading spinner appear
- [ ] Browser console shows "[Forgot Password] Email entered: ..."
- [ ] Browser console shows "[Forgot Password] Sending request to backend..."
- [ ] Network tab shows POST request to `/api/auth/password-reset-request`
- [ ] Wait for response
- [ ] If success: See green success message
- [ ] If error: See red error message
- [ ] Auto-redirect to login after 5 seconds (if success)

---

## Debug Commands

Run these in browser console (F12 → Console):

```javascript
// Check if form elements exist
console.log('forgotPasswordForm:', document.getElementById('forgotPasswordForm'));
console.log('forgotEmail:', document.getElementById('forgotEmail'));
console.log('forgotPasswordBtn:', document.getElementById('forgotPasswordBtn'));

// Check if Auth module exists
console.log('Auth:', Auth);

// Test the form toggle manually
function testToggle() {
    document.getElementById('loginForm').classList.toggle('hidden');
    document.getElementById('forgotPasswordForm').classList.toggle('hidden');
}
testToggle();  // Click and run this

// Test sending request manually
Auth.requestPasswordReset('test@example.com')
    .then(response => console.log('Success:', response))
    .catch(error => console.error('Error:', error));
```

---

## Expected Behavior After Fix

### Frontend
✅ Form toggles when clicking "Forgot password?"
✅ Email input receives focus
✅ Button click calls `handleForgotPasswordRequest()`
✅ Loading state shows while sending
✅ Success/error message appears
✅ Auto-redirect after success

### Backend
✅ Receives POST request at `/api/auth/password-reset-request`
✅ Validates email format
✅ Generates password reset link
✅ Logs request to audit trail
✅ Returns 200 response with success message

### Network
✅ POST request to correct endpoint
✅ Request body contains email JSON
✅ Response status is 200 (success) or 400/500 (error)
✅ Response body contains error/success message

---

## Files Modified

1. **js/auth.js** - Fixed API endpoint path from `/auth/password-reset-request` to `/api/auth/password-reset-request`
2. **js/ui.js** - Removed conflicting back-to-login event listener and added debug logging

## Next Steps

1. ✅ Test the forgot password form manually
2. ✅ Check browser console for debug messages
3. ✅ Verify backend request is being sent
4. ✅ Verify response is received
5. ✅ Test error cases (invalid email, etc.)
6. ✅ Test success case (valid email)

---

## Support

If the issue persists:
1. Check browser console (F12) for errors
2. Check Flask terminal for backend errors
3. Check Network tab in Developer Tools
4. Run the debug commands above
5. Verify Firebase is initialized correctly
6. Check that password-reset.html is accessible

---

**Status:** ✅ Fixed and Ready to Test
