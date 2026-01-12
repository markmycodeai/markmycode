# Auth Microservice (Backend B)

This is a lightweight Node.js microservice designed to trigger Firebase Authentication "Password Reset" emails.
It is required because the Firebase Python Admin SDK cannot trigger these specific email templates, but the Client SDK (Node.js/Web) can.

## Prerequisites
- Node.js (v18+)
- npm

## Setup
1. `npm install`
2. Ensure `.env` is populated (see `.env.example`).
   - `FIREBASE_API_KEY`: Web API Key from Firebase Console
   - `SERVICE_SECRET`: Must match the Python Backend's `SERVICE_SECRET`

## Running
```bash
npm start
```
Runs on Port 3002 by default.

## API
**POST /api/trigger-reset**
Headers:
- `Content-Type: application/json`
- `X-Service-Secret: <your-secret>`

Body:
```json
{ "email": "user@example.com" }
```
