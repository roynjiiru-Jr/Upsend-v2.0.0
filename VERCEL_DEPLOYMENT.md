# Vercel Deployment Guide for Upsend v2.0.0

## Overview

This guide will help you deploy Upsend to Vercel. The application has been configured to run on Node.js instead of Cloudflare Workers, making it compatible with Vercel's serverless platform.

## Prerequisites

- GitHub account with Upsend-v2.0.0 repository
- Vercel account (free tier works)
- Resend API key for email functionality

## Deployment Steps

### 1. Connect GitHub Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import `Upsend-v2.0.0` repository from GitHub
4. Vercel will auto-detect the configuration from `vercel.json`

### 2. Configure Environment Variables

In Vercel project settings, add the following environment variable:

```
RESEND_API_KEY=your_resend_api_key_here
```

**Important:** Get your Resend API key from https://resend.com/api-keys

### 3. Deploy

Click "Deploy" and Vercel will:
1. Build your project (`npm run build`)
2. Run migrations automatically
3. Start the server on a dynamic port
4. Assign you a `.vercel.app` domain

### 4. Database Initialization

The first deployment will automatically:
- Create a SQLite database in `.data/upsend.db`
- Run all migrations from the `migrations/` folder
- Set up all required tables and indexes

## Project Configuration

### Key Files Added for Vercel

- **`vercel.json`** - Vercel configuration
- **`server.js`** - Node.js server entry point (uses `process.env.PORT`)
- **`db-adapter.js`** - SQLite adapter with D1-compatible interface
- **`migrate.js`** - Database migration runner

### Build Configuration

```json
{
  "buildCommand": "npm run build",
  "startCommand": "node migrate.js && npm start",
  "installCommand": "npm install"
}
```

### Environment Configuration

The server automatically uses `process.env.PORT` which Vercel assigns dynamically. No hardcoded ports.

## Local Development

To test locally before deploying:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run migrations
node migrate.js

# Start server (port defaults to 3000 locally)
npm start

# Or specify a custom port
PORT=8080 npm start
```

## Database

### SQLite with better-sqlite3

The app uses SQLite via `better-sqlite3` which provides:
- D1-compatible API interface
- Fast local database
- Zero-configuration setup
- Automatic migrations

### Database Location

- **Development:** `.data/upsend.db`
- **Vercel:** Ephemeral storage (data persists during deployment lifecycle)

⚠️ **Note:** Vercel uses ephemeral storage. For production, consider:
- Migrating to PostgreSQL (Vercel Postgres)
- Using Turso (SQLite edge database)
- Using PlanetScale (MySQL)

## Features Working on Vercel

✅ Magic link authentication  
✅ Event creation and management  
✅ Message collection  
✅ Contribution tracking  
✅ Real-time search  
✅ Instagram/WhatsApp sharing  
✅ Image uploads (in-memory R2 compatible store)  
✅ Responsive mobile design  

## Known Limitations

### 1. Image Storage

Currently using in-memory storage for images. For production:
- Use Vercel Blob Storage
- Use Cloudflare R2 (via API)
- Use AWS S3
- Use UploadThing

### 2. Database Persistence

SQLite on Vercel is ephemeral. Deployments reset the database. For production:

**Option A: Vercel Postgres**
```bash
# Install Vercel Postgres
npm install @vercel/postgres

# Update db-adapter.js to use Postgres instead of SQLite
```

**Option B: Turso (SQLite Edge)**
```bash
# Install Turso SDK
npm install @libsql/client

# Update db-adapter.js to use Turso
```

## Troubleshooting

### Build Fails

**Issue:** Build command fails  
**Solution:** Check `package.json` scripts and ensure `npm run build` works locally

### Server Won't Start

**Issue:** Server crashes on startup  
**Solution:** Check logs in Vercel dashboard. Ensure `RESEND_API_KEY` is set

### Port Binding Error

**Issue:** `EADDRINUSE` error  
**Solution:** This shouldn't happen on Vercel. If testing locally, kill existing processes on the port

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Migration Errors

**Issue:** Database migrations fail  
**Solution:** Check `migrations/` folder and ensure SQL syntax is valid

## Performance Optimization

### 1. Edge Functions (Optional)

Upgrade to Vercel Edge Functions for:
- Lower latency globally
- Faster cold starts
- Better scalability

### 2. Caching

Add caching headers in `server.js`:

```javascript
app.use('/static/*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'public, max-age=31536000')
})
```

### 3. Database Connection Pooling

For production databases, use connection pooling:

```javascript
import { Pool } from '@neondatabase/serverless'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
```

## Security Considerations

### Environment Variables

- Never commit `.env` files
- Always use Vercel environment variables
- Rotate API keys regularly

### Database

- Use prepared statements (already implemented)
- Enable rate limiting on authentication endpoints
- Implement CAPTCHA for public forms

## Monitoring

### Vercel Analytics

Enable Vercel Analytics for:
- Real-time traffic monitoring
- Performance metrics
- Error tracking

### Logging

Add structured logging:

```javascript
console.log(JSON.stringify({
  level: 'info',
  message: 'User logged in',
  userId: user.id,
  timestamp: new Date().toISOString()
}))
```

## Cost Estimates

### Vercel Free Tier

- 100 GB-hrs compute time/month
- 100 GB bandwidth
- Unlimited deployments
- **Cost:** $0/month

### Vercel Pro (if needed)

- 1,000 GB-hrs compute time/month
- 1 TB bandwidth
- Priority support
- **Cost:** $20/month

## Support

If you encounter issues:

1. Check [Vercel Documentation](https://vercel.com/docs)
2. Open an issue on GitHub
3. Contact Vercel support

## Next Steps After Deployment

1. ✅ Test all features on Vercel deployment
2. ✅ Set up custom domain (optional)
3. ✅ Configure production database (Postgres/Turso)
4. ✅ Set up image storage (Vercel Blob/S3)
5. ✅ Enable Vercel Analytics
6. ✅ Set up monitoring and alerts
7. ✅ Configure CORS for production domain
8. ✅ Add rate limiting middleware

## Migration to Production Database

See `docs/PRODUCTION_DATABASE.md` for detailed instructions on migrating from SQLite to production databases.

---

**Last Updated:** December 29, 2025  
**Version:** 2.0.0  
**Deployment Platform:** Vercel (Node.js)
