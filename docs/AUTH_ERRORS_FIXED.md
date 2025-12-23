# Authentication Errors - Fixed Issues

## Issues Found and Fixed

### 1. Missing JWT_SECRET Validation
**Problem**: Code would fail silently or with unclear errors if `JWT_SECRET` was not set.

**Fixed**: Added checks in:
- Registration route
- Login route  
- Authentication middleware

Now returns clear error: `"Server configuration error"` if JWT_SECRET is missing.

### 2. Subscription Creation Error Handling
**Problem**: If subscription creation failed during registration, the entire registration would fail.

**Fixed**: Wrapped subscription creation in try-catch. Registration now succeeds even if subscription creation has issues (idempotent).

### 3. Generic Error Messages
**Problem**: All errors returned generic "Registration failed" or "Login failed" messages.

**Fixed**: Added specific error handling for:
- Database unique violations (23505) - returns "User already exists"
- Foreign key violations (23503) - returns "Database constraint error"
- Development mode shows detailed error messages

### 4. Better Error Logging
**Problem**: Errors were logged but not providing enough context.

**Fixed**: All errors now log full error details to console for debugging.

## Testing Registration

### Valid Registration
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Expected Response** (201):
```json
{
  "user": {
    "id": 1,
    "email": "test@example.com"
  },
  "token": "eyJhbGc..."
}
```

### Duplicate Email
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Expected Response** (409):
```json
{
  "error": "User already exists"
}
```

### Invalid Email
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid-email","password":"password123"}'
```

**Expected Response** (400):
```json
{
  "errors": [
    {
      "msg": "Invalid value",
      "param": "email",
      "location": "body"
    }
  ]
}
```

### Short Password
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"short"}'
```

**Expected Response** (400):
```json
{
  "errors": [
    {
      "msg": "Invalid value",
      "param": "password",
      "location": "body"
    }
  ]
}
```

## Testing Login

### Valid Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Expected Response** (200):
```json
{
  "user": {
    "id": 1,
    "email": "test@example.com"
  },
  "token": "eyJhbGc..."
}
```

### Invalid Credentials
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpassword"}'
```

**Expected Response** (401):
```json
{
  "error": "Invalid credentials"
}
```

### Non-existent User
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com","password":"password123"}'
```

**Expected Response** (401):
```json
{
  "error": "Invalid credentials"
}
```

## Common Issues

### Issue: "Server configuration error"
**Cause**: `JWT_SECRET` not set in `.env` file.

**Fix**: Add to `backend/.env`:
```
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### Issue: "Database constraint error"
**Cause**: Database schema not initialized or foreign key constraint violation.

**Fix**: Run database migration:
```bash
cd backend
npm run migrate
```

### Issue: "Registration failed" / "Login failed"
**Cause**: Database connection issue or other server error.

**Fix**: 
1. Check database is running
2. Verify `DATABASE_URL` in `.env`
3. Check server logs for detailed error

## Error Response Format

### Success
- **200 OK**: Login successful
- **201 Created**: Registration successful

### Client Errors
- **400 Bad Request**: Validation errors (invalid email, short password)
- **401 Unauthorized**: Invalid credentials, missing/invalid token
- **403 Forbidden**: Valid token but insufficient permissions
- **409 Conflict**: Resource already exists (duplicate email)

### Server Errors
- **500 Internal Server Error**: Server configuration or database errors

## Environment Variables Required

Make sure these are set in `backend/.env`:

```bash
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
DATABASE_URL=postgresql://user:pass@localhost:5432/ai_news
```

## Next Steps

After fixing these issues:
1. ✅ Registration should work with proper error messages
2. ✅ Login should work with proper error messages
3. ✅ JWT_SECRET validation prevents silent failures
4. ✅ Better error messages help with debugging

Test the endpoints using the curl commands above or your frontend application.

