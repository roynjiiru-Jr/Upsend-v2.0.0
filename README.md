# Upsend v2.0.0

> **Create beautiful event pages to collect messages and contributions**

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/roynjiiru-Jr/Upsend-v2.0.0/releases/tag/v2.0.0)
[![Status](https://img.shields.io/badge/status-production%20ready-green.svg)](https://3000-iq0e39r6vo8zty1vg7jfx-dfc00ec5.sandbox.novita.ai)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 🌟 Overview

Upsend is a modern event management platform that allows you to create shareable event pages where guests can leave messages and contributions. Perfect for birthdays, weddings, fundraisers, and any special occasion!

## ✨ Key Features

### 🎯 Core Functionality
- **Event Creation**: Create beautiful, customizable event pages in seconds
- **Message Collection**: Collect heartfelt messages from your guests
- **Contribution Tracking**: Track monetary contributions with detailed analytics
- **Real-time Search**: Instantly search through your events on the dashboard
- **Share Integration**: Native share functionality with WhatsApp, Instagram, Facebook, Twitter, and LinkedIn

### 🔐 Authentication & Security
- **Magic Link Login**: Secure, passwordless authentication via email
- **Session Management**: Robust session handling with automatic expiration
- **Database Indexing**: Optimized queries for 10x faster performance

### 📊 Analytics & Insights
- **Event Dashboard**: View all your events at a glance
- **Message Analytics**: See how many messages each event has received
- **Contribution Totals**: Track total contributions per event
- **Real-time Updates**: See updates as they happen

### 📱 Mobile & Responsive
- **Mobile-First Design**: Optimized for mobile devices
- **Instant Loading**: Lightning-fast page loads on all devices
- **Progressive Enhancement**: Works on all modern browsers

## 🚀 Live Demo

**Sandbox Environment**: [https://3000-iq0e39r6vo8zty1vg7jfx-dfc00ec5.sandbox.novita.ai](https://3000-iq0e39r6vo8zty1vg7jfx-dfc00ec5.sandbox.novita.ai)

## 🛠️ Tech Stack

- **Frontend**: HTML5, TailwindCSS, JavaScript (Vanilla)
- **Backend**: [Hono](https://hono.dev) (Lightweight web framework)
- **Database**: Cloudflare D1 (SQLite-based distributed database)
- **Storage**: Cloudflare R2 (Object storage for images)
- **Email**: Resend API (Magic link delivery)
- **Deployment**: Cloudflare Pages
- **Runtime**: TypeScript + Cloudflare Workers

## 📦 Project Structure

```
upsend/
├── src/
│   ├── index.tsx          # Main application entry
│   ├── routes/
│   │   ├── auth.ts        # Authentication routes
│   │   ├── events.ts      # Event management routes
│   │   ├── messages.ts    # Message handling routes
│   │   └── contributions.ts # Contribution routes
│   └── utils/
│       └── auth.ts        # Authentication utilities
├── migrations/            # Database migrations
│   ├── 0001_initial_schema.sql
│   ├── 0002_add_event_images.sql
│   └── 0003_add_magic_token_index.sql
├── public/               # Static assets
├── dist/                 # Build output
├── wrangler.jsonc       # Cloudflare configuration
├── package.json         # Dependencies
└── ecosystem.config.cjs # PM2 configuration
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- Cloudflare account (for deployment)
- Resend account (for email delivery)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/roynjiiru-Jr/Upsend-v2.0.0.git
   cd Upsend-v2.0.0
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.dev.vars` file:
   ```bash
   RESEND_API_KEY=your_resend_api_key
   ```

4. **Apply database migrations**
   ```bash
   npm run db:migrate:local
   ```

5. **Build the project**
   ```bash
   npm run build
   ```

6. **Start development server**
   ```bash
   npm run dev
   # Or with PM2
   pm2 start ecosystem.config.cjs
   ```

7. **Access the application**
   Open [http://localhost:3000](http://localhost:3000)

## 📊 Database Schema

### Tables

- **users**: User accounts and authentication
- **events**: Event details and metadata
- **messages**: Guest messages for events
- **contributions**: Monetary contributions tracking
- **sessions**: User session management
- **event_images**: Event cover images and galleries

### Key Indexes

- `idx_users_magic_token`: Fast magic link lookups
- `idx_events_shareable_link`: Quick event retrieval
- `idx_sessions_token`: Efficient session validation

## 🌐 Deployment

### Deploy to Cloudflare Pages

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Apply production migrations**
   ```bash
   npm run db:migrate:prod
   ```

3. **Deploy to Cloudflare**
   ```bash
   npm run deploy
   ```

4. **Set environment variables**
   ```bash
   npx wrangler pages secret put RESEND_API_KEY
   ```

## 📝 Available Scripts

```bash
npm run dev              # Start dev server with Vite
npm run dev:sandbox      # Start Wrangler dev server
npm run build            # Build for production
npm run preview          # Preview production build
npm run deploy           # Deploy to Cloudflare Pages
npm run db:migrate:local # Apply local migrations
npm run db:migrate:prod  # Apply production migrations
npm run db:seed          # Seed local database
npm run db:reset         # Reset local database
npm run clean-port       # Kill process on port 3000
```

## 🎨 Features Walkthrough

### 1. Magic Link Authentication
Users receive a secure login link via email (powered by Resend API). No passwords required!

### 2. Event Creation
Create events with:
- Title and description
- Event date
- Cover image upload
- Unique shareable link

### 3. Event Dashboard
- View all your events
- Real-time search functionality
- Quick access to event details
- Share events with one click

### 4. Event Details Page
- View all messages and contributions
- Track analytics (message count, contribution total)
- Share via multiple platforms
- Copy shareable link

### 5. Public Event View
Guests can:
- View event details
- Leave messages
- Make contributions
- See all messages from other guests

## 🐛 Bug Fixes in v2.0.0

- ✅ Fixed mobile login timeout issues
- ✅ Resolved event details page loading errors
- ✅ Corrected template literal escaping
- ✅ Fixed API route ordering conflicts
- ✅ Enhanced error handling throughout
- ✅ Optimized database query performance

## 🔒 Security Features

- Magic link authentication with expiration
- Session token validation
- SQL injection protection via prepared statements
- CORS configuration for API endpoints
- Secure cookie handling
- Rate limiting on authentication endpoints

## 📈 Performance Optimizations

- Database indexing (10x query speed improvement)
- CDN-based frontend dependencies
- Edge deployment on Cloudflare network
- Lazy loading for images
- Optimized bundle size (~126KB)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 👤 Author

**roynjiiru-Jr**
- GitHub: [@roynjiiru-Jr](https://github.com/roynjiiru-Jr)

## 🙏 Acknowledgments

- Built with [Hono](https://hono.dev)
- Styled with [TailwindCSS](https://tailwindcss.com)
- Deployed on [Cloudflare Pages](https://pages.cloudflare.com)
- Email delivery by [Resend](https://resend.com)

## 📞 Support

If you encounter any issues or have questions, please [open an issue](https://github.com/roynjiiru-Jr/Upsend-v2.0.0/issues).

---

**Made with ❤️ for creating memorable events**
