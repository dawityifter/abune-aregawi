# Deployment Guide

## Environment Variables Setup

### Required Environment Variables

#### Database
```bash
DATABASE_URL=postgresql://username:password@host:port/database
```

#### Firebase Configuration
```bash
FIREBASE_SERVICE_ACCOUNT_BASE64=your_base64_encoded_service_account_json
```

#### Server Configuration
```bash
PORT=10000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
```

#### JWT Configuration
```bash
JWT_SECRET=your_long_random_jwt_secret
JWT_EXPIRES_IN=7d
```

### Optional Environment Variables

#### Stripe Configuration (Required for donations)
```bash
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
```

#### Email Configuration (Optional)
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@yourdomain.com
```

## Deployment Platforms

### Render.com

1. **Connect your GitHub repository**
2. **Set environment variables** in the Render dashboard:
   - Go to your service → Environment
   - Add all required environment variables
3. **Build Command**: `cd backend && npm install`
4. **Start Command**: `cd backend && npm start`

### Railway.app

1. **Connect your GitHub repository**
2. **Set environment variables** in the Railway dashboard
3. **Deploy automatically** on push to main branch

### Heroku

1. **Create a new Heroku app**
2. **Set environment variables**:
   ```bash
   heroku config:set DATABASE_URL=your_database_url
   heroku config:set FIREBASE_SERVICE_ACCOUNT_BASE64=your_firebase_config
   heroku config:set JWT_SECRET=your_jwt_secret
   heroku config:set NODE_ENV=production
   heroku config:set PORT=10000
   ```
3. **Deploy**:
   ```bash
   git push heroku main
   ```

## Troubleshooting

### Common Issues

#### 1. Stripe API Key Missing
**Error**: `Neither apiKey nor config.authenticator provided`

**Solution**: 
- Add `STRIPE_SECRET_KEY` to your environment variables
- If you don't need Stripe functionality, the server will now start without it

#### 2. Database Connection Issues
**Error**: `Connection to database failed`

**Solution**:
- Verify `DATABASE_URL` is correct
- Ensure database is accessible from your deployment platform
- Check if database requires SSL connections

#### 3. Firebase Configuration Issues
**Error**: `Firebase Admin SDK initialization failed`

**Solution**:
- Ensure `FIREBASE_SERVICE_ACCOUNT_BASE64` is properly set
- Verify the service account JSON is correctly base64 encoded
- Check if the service account has the necessary permissions

#### 4. Port Issues
**Error**: `EADDRINUSE` or port binding issues

**Solution**:
- Set `PORT` environment variable to the port provided by your hosting platform
- Most platforms will set this automatically

### Health Check

The application includes a health check endpoint at `/api/health` that returns:

```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production",
  "database": "connected",
  "stripe": "configured",
  "firebase": "configured"
}
```

### Testing Deployment

1. **Check health endpoint**:
   ```bash
   curl https://your-backend-domain.com/api/health
   ```

2. **Test database connection**:
   ```bash
   curl https://your-backend-domain.com/api/members/registration-status
   ```

3. **Test Firebase connection**:
   ```bash
   curl https://your-backend-domain.com/api/members/test-auth
   ```

## Security Considerations

### Environment Variables
- Never commit sensitive environment variables to version control
- Use platform-specific secret management
- Rotate secrets regularly

### Database Security
- Use SSL connections for production databases
- Implement proper database user permissions
- Regular backups

### API Security
- Implement rate limiting
- Use HTTPS in production
- Validate all inputs
- Implement proper CORS policies

## Monitoring

### Logs
- Monitor application logs for errors
- Set up log aggregation (e.g., Loggly, Papertrail)
- Implement structured logging

### Performance
- Monitor response times
- Set up alerts for high error rates
- Monitor database connection pool usage

### Health Checks
- Set up automated health checks
- Monitor the `/api/health` endpoint
- Alert on service degradation

## Backup Strategy

### Database Backups
- Set up automated database backups
- Test restore procedures regularly
- Store backups in multiple locations

### Code Backups
- Use version control (Git)
- Tag releases for easy rollback
- Maintain deployment documentation

## Rollback Procedure

1. **Identify the issue**
2. **Revert to previous deployment**:
   ```bash
   git revert HEAD
   git push origin main
   ```
3. **Or rollback to specific commit**:
   ```bash
   git checkout <commit-hash>
   git push origin main --force
   ```
4. **Verify rollback**:
   ```bash
   curl https://your-backend-domain.com/api/health
   ```

## Support

For deployment issues:
1. Check the health endpoint
2. Review application logs
3. Verify environment variables
4. Test database connectivity
5. Contact support with specific error messages
