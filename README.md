# Upsend - Event Page Platform

A full-stack web application for creating beautiful event pages to collect messages and contributions.

## 🌐 Live URLs

- **Production URL**: https://3000-iq0e39r6vo8zty1vg7jfx-dfc00ec5.sandbox.novita.ai
- **GitHub**: (To be deployed)

## ✨ Features

### Completed Features
✅ **User Authentication**
- Magic link email authentication (MVP mode with dev token)
- Secure session management with 30-day expiry
- Automatic user creation on first login

✅ **Event Management**
- Create events with title, description, date, and optional cover image
- Generate unique shareable links (8-character codes)
- View all created events in dashboard
- Track event statistics (messages, contributions, total amount)

✅ **Public Event Pages**
- Beautiful responsive event pages
- Allow visitors to leave messages (with optional name)
- Allow visitors to make contributions (with optional name and amount)
- Display all messages publicly (no timestamps shown to visitors)
- Hide contribution amounts from public view

✅ **Creator Dashboard**
- View all events with statistics
- Access detailed event information
- View all messages with timestamps
- View all contributions privately with amounts and timestamps
- Calculate total contribution amounts
- Copy shareable links easily

✅ **Modern UI/UX**
- Soft gradient colors (purple, pink, blue)
- Mobile-first responsive design
- Clean, modern interface with TailwindCSS
- Font Awesome icons
- Smooth transitions and hover effects

## 🗄️ Data Architecture

### Database Schema (Cloudflare D1 - SQLite)

**Users Table**
- `id`: Primary key
- `email`: Unique email address
- `name`: User's display name
- `magic_token`: Temporary token for authentication
- `magic_token_expires_at`: Token expiration timestamp
- `created_at`: Account creation timestamp

**Events Table**
- `id`: Primary key
- `user_id`: Foreign key to users
- `title`: Event title
- `description`: Optional event description
- `event_date`: Event date
- `cover_image`: Optional cover image URL
- `shareable_link`: Unique 8-character code
- `created_at`: Event creation timestamp

**Messages Table**
- `id`: Primary key
- `event_id`: Foreign key to events
- `user_name`: Optional message author name
- `message_text`: Message content
- `created_at`: Message timestamp (hidden from public)

**Contributions Table** (Private to creator)
- `id`: Primary key
- `event_id`: Foreign key to events
- `contributor_name`: Optional contributor name
- `amount`: Contribution amount
- `created_at`: Contribution timestamp (private)

**Sessions Table**
- `id`: Primary key
- `user_id`: Foreign key to users
- `session_token`: Unique session identifier
- `expires_at`: Session expiration timestamp
- `created_at`: Session creation timestamp

### Storage Services
- **Cloudflare D1**: SQLite-based database for all relational data
- **Cloudflare Workers**: Edge runtime for API endpoints
- **Cloudflare Pages**: Static site hosting with SSR support

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/magic-link` - Request magic link (email + optional name)
- `POST /api/auth/verify` - Verify magic token and create session
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout and destroy session

### Events
- `POST /api/events/create` - Create new event (requires auth)
- `GET /api/events/:shareableLink` - Get public event details
- `GET /api/events/creator/list` - Get all user's events (requires auth)
- `GET /api/events/creator/:eventId` - Get detailed event info with private data (requires auth)

### Messages
- `POST /api/messages/create` - Create message on event (no auth required)

### Contributions
- `POST /api/contributions/create` - Create contribution on event (no auth required)

## 📱 Frontend Pages

1. **Landing Page** (`/`) - Marketing page with feature overview
2. **Auth Page** (`/auth`) - Magic link authentication
3. **Dashboard** (`/dashboard`) - Creator's event list with statistics
4. **Create Event** (`/create-event`) - Event creation form
5. **Public Event Page** (`/event/:shareableLink`) - Public-facing event page
6. **Event Details** (`/event-details/:eventId`) - Private creator view with contributions

## 🛠️ Tech Stack

- **Backend**: Hono (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: HTML + TailwindCSS + Vanilla JavaScript
- **Hosting**: Cloudflare Pages
- **Runtime**: Cloudflare Workers
- **Build Tool**: Vite
- **Process Manager**: PM2 (development)

## 🚀 Development

### Prerequisites
- Node.js 18+
- npm or pnpm
- Cloudflare account (for production deployment)

### Local Setup

```bash
# Install dependencies
npm install

# Run database migrations
npm run db:migrate:local

# Build the project
npm run build

# Start development server
npm run dev:sandbox

# Or use PM2
pm2 start ecosystem.config.cjs
```

### Database Management

```bash
# Apply migrations locally
npm run db:migrate:local

# Apply migrations to production
npm run db:migrate:prod

# Execute SQL locally
npm run db:console:local

# Execute SQL in production
npm run db:console:prod
```

## 📝 Usage Guide

### For Event Creators

1. **Sign Up/Sign In**
   - Go to `/auth`
   - Enter your email and name
   - Click "Continue with Email"
   - Use the magic link to verify (in MVP, click the provided link)

2. **Create an Event**
   - From dashboard, click "Create Event"
   - Fill in event details (title, description, date)
   - Optionally add a cover image URL
   - Submit to create event

3. **Share Your Event**
   - Copy the shareable link from dashboard
   - Share with guests via email, social media, etc.

4. **Track Responses**
   - View all events in dashboard
   - Click "View Details" to see:
     - All messages with timestamps
     - All contributions with amounts (private)
     - Total contribution amount

### For Event Guests

1. **Visit Event Page**
   - Open the shareable link (e.g., `/event/abc12345`)
   - View event details

2. **Leave a Message**
   - Enter your name (optional)
   - Write your message
   - Click "Send Message"

3. **Make a Contribution**
   - Enter your name (optional)
   - Enter amount
   - Click "Contribute"

## 🔒 Privacy & Security

- **Public Data**: Event details, messages (without timestamps)
- **Private Data**: Contribution amounts, contributor names, all timestamps
- **Authentication**: Magic link with session tokens
- **Session Duration**: 30 days
- **Magic Link Expiry**: 15 minutes

## 🎯 Key Design Decisions

1. **No Passwords**: Magic link authentication simplifies UX
2. **Hidden Timestamps**: Creates timeless feel for public messages
3. **Private Contributions**: Only creator sees who contributed and amounts
4. **Short Links**: 8-character codes are memorable and shareable
5. **Mobile-First**: Optimized for mobile viewing and interaction
6. **Soft Colors**: Purple/pink gradient creates friendly, celebratory atmosphere

## 📋 Testing the MVP

### Test Flow
```bash
# 1. Request magic link
curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'
# Response includes dev_token

# 2. Verify token
curl -X POST http://localhost:3000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_TOKEN_HERE"}'
# Response includes session_token

# 3. Create event
curl -X POST http://localhost:3000/api/events/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{"title":"Test Event","event_date":"2025-12-25"}'
# Response includes shareable_link

# 4. View public event
curl http://localhost:3000/api/events/SHAREABLE_LINK

# 5. Add message (no auth)
curl -X POST http://localhost:3000/api/messages/create \
  -H "Content-Type: application/json" \
  -d '{"event_id":1,"user_name":"Guest","message_text":"Great event!"}'

# 6. Add contribution (no auth)
curl -X POST http://localhost:3000/api/contributions/create \
  -H "Content-Type: application/json" \
  -d '{"event_id":1,"contributor_name":"Supporter","amount":25.00}'

# 7. View creator details (requires auth)
curl http://localhost:3000/api/events/creator/1 \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## 🚢 Deployment to Cloudflare Pages

### Prerequisites
1. Create Cloudflare account
2. Set up Cloudflare API token
3. Create D1 database in production

### Deployment Steps

```bash
# 1. Create production D1 database
npx wrangler d1 create upsend-production
# Copy database_id to wrangler.jsonc

# 2. Apply migrations to production
npm run db:migrate:prod

# 3. Build project
npm run build

# 4. Create Cloudflare Pages project
npx wrangler pages project create upsend --production-branch main

# 5. Deploy to Cloudflare Pages
npm run deploy
```

### Environment Variables (Production)
Set these in Cloudflare Dashboard:
- `DATABASE_ID`: Your D1 database ID

## 🔄 Future Enhancements

- [ ] Email integration for magic links
- [ ] Image upload for cover images
- [ ] Payment integration (Stripe) for contributions
- [ ] Email notifications for new messages/contributions
- [ ] Export data (CSV/PDF)
- [ ] Custom event themes
- [ ] Social media preview cards
- [ ] Analytics dashboard
- [ ] Multiple events per shareable link
- [ ] Event expiration/archiving
- [ ] Guest RSVP tracking

## 📊 Current Status

**Deployment**: ✅ Active (Development)
**Last Updated**: December 2, 2025
**Version**: 1.0.0 MVP

## 🤝 Contributing

This is an MVP project. For production use:
1. Replace dev_token response with actual email sending
2. Add proper error handling and logging
3. Implement rate limiting
4. Add input sanitization
5. Set up monitoring and analytics
6. Add automated tests
7. Implement proper payment processing

## 📄 License

MIT License - Feel free to use for your projects!

---

Built with ❤️ using Hono, Cloudflare Workers, and TailwindCSS
