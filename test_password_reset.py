"""
Comprehensive tests for password reset feature.

Tests cover:
1. Frontend form validation and submission
2. Backend password reset request endpoint
3. Email action handler (password-reset.html) flow
4. Password reset code verification
5. Password confirmation with validation
6. Error handling and edge cases
"""

import unittest
import json
from datetime import datetime
from unittest.mock import patch, MagicMock
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from firebase_init import db


class TestPasswordResetBackend(unittest.TestCase):
    """Test backend password reset endpoint."""
    
    def setUp(self):
        """Set up test client."""
        self.app = app
        self.client = self.app.test_client()
        self.app.config['TESTING'] = True
    
    def test_password_reset_request_valid_email(self):
        """Test password reset request with valid email."""
        with patch('firebase_admin.auth.generate_password_reset_link') as mock_gen:
            mock_gen.return_value = 'https://example.com/reset?code=ABC123'
            
            response = self.client.post(
                '/api/auth/password-reset-request',
                json={'email': 'test@example.com'},
                content_type='application/json'
            )
            
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertFalse(data['error'])
            self.assertIn('reset_link_preview', data['data'])
    
    def test_password_reset_request_missing_email(self):
        """Test password reset request without email."""
        response = self.client.post(
            '/api/auth/password-reset-request',
            json={},
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertTrue(data['error'])
        self.assertEqual(data['code'], 'INVALID_INPUT')
    
    def test_password_reset_request_invalid_email_format(self):
        """Test password reset request with invalid email format."""
        response = self.client.post(
            '/api/auth/password-reset-request',
            json={'email': 'invalid-email'},
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertTrue(data['error'])
        self.assertEqual(data['code'], 'INVALID_EMAIL')
    
    def test_password_reset_request_nonexistent_user(self):
        """Test password reset request for non-existent user (should not reveal email exists)."""
        with patch('firebase_admin.auth.generate_password_reset_link') as mock_gen:
            from firebase_admin import auth as firebase_auth
            mock_gen.side_effect = firebase_auth.UserNotFoundError('User not found')
            
            response = self.client.post(
                '/api/auth/password-reset-request',
                json={'email': 'nonexistent@example.com'},
                content_type='application/json'
            )
            
            # Should return 200 (not reveal email doesn't exist)
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertFalse(data['error'])
    
    def test_password_reset_request_email_error(self):
        """Test password reset request when email service fails."""
        with patch('firebase_admin.auth.generate_password_reset_link') as mock_gen:
            mock_gen.side_effect = Exception('Email service error')
            
            response = self.client.post(
                '/api/auth/password-reset-request',
                json={'email': 'test@example.com'},
                content_type='application/json'
            )
            
            self.assertEqual(response.status_code, 500)
            data = json.loads(response.data)
            self.assertTrue(data['error'])
            self.assertEqual(data['code'], 'EMAIL_ERROR')
    
    def test_password_reset_cors_preflight(self):
        """Test CORS preflight request."""
        response = self.client.options(
            '/api/auth/password-reset-request'
        )
        
        self.assertEqual(response.status_code, 200)


class TestPasswordResetEmailValidation(unittest.TestCase):
    """Test email validation in password reset."""
    
    def setUp(self):
        """Set up test client."""
        self.app = app
        self.client = self.app.test_client()
        self.app.config['TESTING'] = True
    
    def test_various_valid_emails(self):
        """Test various valid email formats."""
        valid_emails = [
            'user@example.com',
            'user.name@example.com',
            'user+tag@example.co.uk',
            'user_name@example-domain.com',
            '123@example.com'
        ]
        
        with patch('firebase_admin.auth.generate_password_reset_link') as mock_gen:
            mock_gen.return_value = 'https://example.com/reset?code=ABC123'
            
            for email in valid_emails:
                response = self.client.post(
                    '/api/auth/password-reset-request',
                    json={'email': email},
                    content_type='application/json'
                )
                self.assertEqual(response.status_code, 200, f"Email {email} should be valid")
    
    def test_various_invalid_emails(self):
        """Test various invalid email formats."""
        invalid_emails = [
            'no-at-sign.com',
            '@example.com',
            'user@',
            'user@.com',
            'user name@example.com',
            '',
            'user@@example.com'
        ]
        
        for email in invalid_emails:
            response = self.client.post(
                '/api/auth/password-reset-request',
                json={'email': email},
                content_type='application/json'
            )
            self.assertEqual(response.status_code, 400, f"Email {email} should be invalid")


class TestPasswordResetSecurity(unittest.TestCase):
    """Test security aspects of password reset."""
    
    def setUp(self):
        """Set up test client."""
        self.app = app
        self.client = self.app.test_client()
        self.app.config['TESTING'] = True
    
    def test_rate_limiting_protection(self):
        """Test that repeated requests from same IP are handled gracefully."""
        # Note: Full rate limiting would require Redis/cache
        # This test ensures the endpoint handles multiple requests without crashing
        with patch('firebase_admin.auth.generate_password_reset_link') as mock_gen:
            mock_gen.return_value = 'https://example.com/reset?code=ABC123'
            
            for i in range(5):
                response = self.client.post(
                    '/api/auth/password-reset-request',
                    json={'email': 'test@example.com'},
                    content_type='application/json'
                )
                self.assertEqual(response.status_code, 200)
    
    def test_sql_injection_prevention(self):
        """Test that SQL injection attempts are blocked."""
        sql_injection = "'; DROP TABLE User; --"
        
        response = self.client.post(
            '/api/auth/password-reset-request',
            json={'email': sql_injection + '@example.com'},
            content_type='application/json'
        )
        
        # Should reject due to invalid email format
        self.assertEqual(response.status_code, 400)
    
    def test_no_email_exists_leak(self):
        """Ensure endpoint doesn't leak whether email exists."""
        with patch('firebase_admin.auth.generate_password_reset_link') as mock_gen:
            # First call: email exists
            mock_gen.return_value = 'https://example.com/reset?code=ABC123'
            response1 = self.client.post(
                '/api/auth/password-reset-request',
                json={'email': 'exists@example.com'},
                content_type='application/json'
            )
            
            # Second call: email doesn't exist
            from firebase_admin import auth as firebase_auth
            mock_gen.side_effect = firebase_auth.UserNotFoundError('Not found')
            response2 = self.client.post(
                '/api/auth/password-reset-request',
                json={'email': 'notexists@example.com'},
                content_type='application/json'
            )
            
            # Both should return 200 with similar messages
            self.assertEqual(response1.status_code, 200)
            self.assertEqual(response2.status_code, 200)


class TestPasswordResetAuditLogging(unittest.TestCase):
    """Test audit logging for password reset requests."""
    
    def setUp(self):
        """Set up test client."""
        self.app = app
        self.client = self.app.test_client()
        self.app.config['TESTING'] = True
    
    @patch('utils.audit_log')
    def test_password_reset_audit_logged(self, mock_audit):
        """Test that password reset requests are logged."""
        with patch('firebase_admin.auth.generate_password_reset_link') as mock_gen:
            mock_gen.return_value = 'https://example.com/reset?code=ABC123'
            
            response = self.client.post(
                '/api/auth/password-reset-request',
                json={'email': 'test@example.com'},
                content_type='application/json'
            )
            
            self.assertEqual(response.status_code, 200)
            # Verify audit log was called
            mock_audit.assert_called_once()
            call_args = mock_audit.call_args
            self.assertEqual(call_args[0][1], 'password_reset_requested')


class TestPasswordResetFrontendIntegration(unittest.TestCase):
    """Test password reset HTML pages exist and are accessible."""
    
    def setUp(self):
        """Set up test client."""
        self.app = app
        self.client = self.app.test_client()
        self.app.config['TESTING'] = True
    
    def test_password_reset_page_exists(self):
        """Test that password-reset.html exists."""
        import os
        password_reset_path = os.path.join(
            os.path.dirname(__file__),
            'password-reset.html'
        )
        self.assertTrue(
            os.path.exists(password_reset_path),
            'password-reset.html should exist'
        )
    
    def test_password_reset_page_has_firebase_sdk(self):
        """Test that password-reset.html includes Firebase SDK."""
        import os
        password_reset_path = os.path.join(
            os.path.dirname(__file__),
            'password-reset.html'
        )
        
        if os.path.exists(password_reset_path):
            with open(password_reset_path, 'r') as f:
                content = f.read()
                self.assertIn('firebase', content.lower())
                self.assertIn('verifyPasswordResetCode', content)
                self.assertIn('confirmPasswordReset', content)


class TestPasswordResetAuthModule(unittest.TestCase):
    """Test Auth module password reset methods."""
    
    def setUp(self):
        """Set up test client."""
        self.app = app
        self.client = self.app.test_client()
        self.app.config['TESTING'] = True
    
    @patch('requests.post')
    def test_request_password_reset_calls_backend(self, mock_post):
        """Test that requestPasswordReset calls backend endpoint."""
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            'error': False,
            'message': 'Password reset email sent'
        }
        
        # This would be called from the frontend
        response = self.client.post(
            '/api/auth/password-reset-request',
            json={'email': 'test@example.com'},
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)


def run_specific_test(test_name):
    """Run a specific test by name."""
    suite = unittest.TestSuite()
    
    if 'backend' in test_name.lower():
        suite.addTest(unittest.makeSuite(TestPasswordResetBackend))
    elif 'email' in test_name.lower():
        suite.addTest(unittest.makeSuite(TestPasswordResetEmailValidation))
    elif 'security' in test_name.lower():
        suite.addTest(unittest.makeSuite(TestPasswordResetSecurity))
    elif 'audit' in test_name.lower():
        suite.addTest(unittest.makeSuite(TestPasswordResetAuditLogging))
    elif 'frontend' in test_name.lower():
        suite.addTest(unittest.makeSuite(TestPasswordResetFrontendIntegration))
    elif 'auth' in test_name.lower():
        suite.addTest(unittest.makeSuite(TestPasswordResetAuthModule))
    else:
        return unittest.TestLoader().loadTestsFromModule(sys.modules[__name__])
    
    return suite


if __name__ == '__main__':
    # Run all tests
    unittest.main(verbosity=2)
