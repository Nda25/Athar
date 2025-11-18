# أثــر (Athar) - Educational Platform

A comprehensive Arabic educational platform built with modern web technologies, featuring user authentication, subscription management, AI-powered tools, and a complete complaint management system.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Features](#features)
- [Pages & Routes](#pages--routes)
- [Backend API (Netlify Functions)](#backend-api-netlify-functions)
- [Database Schema](#database-schema)
- [Authentication](#authentication)
- [Styling & Design](#styling--design)
- [Development](#development)
- [Deployment](#deployment)

---

## 🎯 Project Overview

**Athar** is an educational platform designed to provide Arabic learners with structured learning programs, AI-powered writing assistance, and interactive tools. The platform includes:

- User authentication via Auth0
- Subscription management with Moyasar payments
- Multiple learning programs (Darsi, Ethraa, Masar, Miyad, Mueen, Mulham, Mutasiq)
- AI-powered content generation using Google Gemini
- Complaint and feedback management system
- Admin dashboard for management
- User profile management
- Responsive design for all devices

---

## 🛠 Tech Stack

### Frontend

- **HTML5** - Semantic markup
- **CSS3** - Modern styling with CSS variables and Grid/Flexbox
- **JavaScript (ES6+)** - Client-side logic
- **Auth0 SPA SDK** - Authentication
- **Supabase JS Client** - Database operations

### Backend

- **Netlify Functions** - Serverless backend
- **Node.js** - Runtime environment
- **Express-like routing** - Function-based API

### Database & Services

- **Supabase (PostgreSQL)** - Primary database
- **Auth0** - Authentication & authorization
- **Moyasar** - Payment processing
- **Google Gemini AI** - Content generation
- **Nodemailer** - Email notifications
- **Supabase Storage** - File uploads (avatars, etc.)

### Deployment

- **Netlify** - Hosting & serverless functions
- **Git** - Version control

---

## 📁 Project Structure

```
Athar/beta/
├── index.html                 # Landing page
├── profile.html              # User profile page
├── admin.html                # Admin dashboard
├── pricing.html              # Pricing page
├── complaints.html           # Complaint submission page
├── privacy.html              # Privacy policy
├── terms.html                # Terms & conditions
├── refund-policy.html        # Refund policy
├── whatsapp.html             # WhatsApp contact page
│
├── Learning Programs (HTML)
├── darsi.html                # Darsi program
├── ethraa.html               # Ethraa program
├── masar.html                # Masar program
├── miyad.html                # Miyad program
├── mueen.html                # Mueen program
├── mulham.html               # Mulham program
├── mutasiq.html              # Mutasiq program
│
├── style.css                 # Global styles
├── app.js                    # Global app logic
│
├── assets/
│   ├── css/                  # Page-specific styles
│   │   ├── admin.css
│   │   ├── profile.css
│   │   ├── navbar.css
│   │   ├── footer.css
│   │   └── [program-specific].css
│   │
│   ├── js/                   # Client-side scripts
│   │   ├── profile.js        # Profile page logic
│   │   ├── admin.js          # Admin dashboard logic
│   │   ├── navbar.js         # Navbar functionality
│   │   ├── component-loader.js
│   │   ├── supabase-client.js
│   │   ├── require-auth.js
│   │   ├── theme.js
│   │   ├── ui.js
│   │   └── [program-specific].js
│   │
│   ├── icons/                # Icon files
│   ├── img/                  # Images
│   ├── bg/                   # Background images
│   └── vendor/               # Third-party libraries
│
├── components/
│   ├── navbar.html           # Navigation bar component
│   ├── footer.html           # Footer component
│   └── header.html           # Header component
│
├── netlify/
│   └── functions/            # Serverless backend functions
│       ├── _auth.js          # Auth utilities
│       ├── _cors.js          # CORS utilities
│       ├── _shared-utils.js  # Shared utilities
│       ├── _supa.js          # Supabase utilities
│       │
│       ├── Authentication & User
│       ├── upsert-user.js
│       ├── user-status.js
│       │
│       ├── Complaints Management
│       ├── complaints-create.js
│       ├── complaints-list.js
│       ├── complaints-get.js
│       ├── complaints-reply.js
│       ├── complaints-update.js
│       ├── complaint-messages.js
│       ├── complaint-user-reply.js
│       ├── user-complaints-list.js
│       │
│       ├── Payments & Invoices
│       ├── payments-create-invoice.js
│       ├── payments-webhook.js
│       ├── moyasar-webhook.js
│       ├── invoices-list.js
│       ├── promo-redeem.js
│       │
│       ├── Admin Functions
│       ├── admin-activate.js
│       ├── admin-announcement.js
│       ├── admin-users-list.js
│       │
│       ├── AI & Content Generation
│       ├── gemini-ethraa.js
│       ├── gemini-mithaq.js
│       ├── strategy.js
│       │
│       ├── Program Management
│       ├── add-miyad-event.js
│       ├── delete-miyad-event.js
│       ├── remind-miyad.js
│       ├── mueen-plan.js
│       ├── mulham.js
│       ├── murtakaz.js
│       │
│       └── Utilities
│           ├── log-tool-usage.js
│           ├── storage-ensure.js
│           ├── get-reminder-settings.js
│           └── save-reminder-settings.js
│
├── netlify.toml              # Netlify configuration
├── package.json              # Dependencies
└── .env                      # Environment variables (not in git)
```

---

## 🚀 Setup & Installation

### Prerequisites

- Node.js 16+ and npm
- Git
- Netlify CLI (for local development)
- Auth0 account
- Supabase account
- Moyasar account (for payments)
- Google Cloud account (for Gemini API)

### Installation Steps

1. **Clone the repository**

```bash
git clone <repository-url>
cd Athar/beta
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables** (see [Environment Variables](#environment-variables))

```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Install Netlify CLI** (for local development)

```bash
npm install -g netlify-cli
```

5. **Link to Netlify**

```bash
netlify link
```

6. **Start local development server**

```bash
netlify dev
```

The site will be available at `http://localhost:8888`

---

## 🔐 Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Auth0
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=https://api.n-athar.co
AUTH0_ISSUER=https://your-domain.auth0.com/
CLAIM_NAMESPACE=https://n-athar.co/

# Moyasar (Payments)
MOYASAR_API_KEY=your-moyasar-api-key
MOYASAR_WEBHOOK_SECRET=your-webhook-secret

# Google Gemini
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key

# Email (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# WhatsApp
WHATSAPP_NUMBER=+966XXXXXXXXX

# Resend (Email service)
RESEND_API_KEY=your-resend-api-key
```

---

## ✨ Features

### User Features

- ✅ User authentication via Auth0
- ✅ Profile management (avatar, name, email)
- ✅ Theme customization (multiple color schemes)
- ✅ Subscription management
- ✅ Invoice history
- ✅ Complaint submission and tracking
- ✅ Message history with admin
- ✅ Responsive design for all devices

### Learning Programs

- 📚 **Darsi** - Daily lessons
- 💡 **Ethraa** - Enrichment content with AI assistance
- 🗺️ **Masar** - Learning path
- 📅 **Miyad** - Event scheduling
- 🤝 **Mueen** - Peer support
- 🎯 **Mulham** - Challenges
- 🔗 **Mutasiq** - Interconnected learning

### Admin Features

- 👥 User management
- 💳 Manual subscription activation
- 📢 Announcements
- 💬 Complaint management with replies
- 📊 User analytics
- 🎁 Promo code management

### AI Features

- 🤖 AI-powered content generation (Ethraa)
- 📝 Writing assistance
- 🎓 Strategy recommendations

### Payment Features

- 💰 Moyasar payment integration
- 📄 Invoice generation
- 🎟️ Promo code redemption
- 📧 Payment notifications

---

## 📄 Pages & Routes

| Page       | Route                 | Purpose                  |
| ---------- | --------------------- | ------------------------ |
| Landing    | `/index.html`         | Main landing page        |
| Profile    | `/profile.html`       | User profile & settings  |
| Admin      | `/admin.html`         | Admin dashboard          |
| Pricing    | `/pricing.html`       | Subscription plans       |
| Complaints | `/complaints.html`    | Submit complaints        |
| Programs   | `/programs.html`      | Browse learning programs |
| Darsi      | `/darsi.html`         | Daily lessons            |
| Ethraa     | `/ethraa.html`        | Enrichment with AI       |
| Masar      | `/masar.html`         | Learning path            |
| Miyad      | `/miyad.html`         | Event scheduling         |
| Mueen      | `/mueen.html`         | Peer support             |
| Mulham     | `/mulham.html`        | Challenges               |
| Mutasiq    | `/mutasiq.html`       | Interconnected learning  |
| Privacy    | `/privacy.html`       | Privacy policy           |
| Terms      | `/terms.html`         | Terms & conditions       |
| Refund     | `/refund-policy.html` | Refund policy            |
| WhatsApp   | `/whatsapp.html`      | WhatsApp contact         |

---

## 🔌 Backend API (Netlify Functions)

### Authentication Functions

- `POST /.netlify/functions/upsert-user` - Create/update user profile
- `GET /.netlify/functions/user-status` - Get user subscription status

### Complaint Management

- `POST /.netlify/functions/complaints-create` - Submit new complaint
- `GET /.netlify/functions/user-complaints-list` - Get user's complaints
- `GET /.netlify/functions/complaints-list` - Get all complaints (admin)
- `GET /.netlify/functions/complaints-get?id=<uuid>` - Get complaint details (admin)
- `GET /.netlify/functions/complaint-messages?complaint_id=<uuid>&user_email=<email>` - Get message thread
- `POST /.netlify/functions/complaint-user-reply` - User reply to complaint
- `POST /.netlify/functions/complaints-reply` - Admin reply (admin only)
- `POST /.netlify/functions/complaints-update` - Update complaint status (admin)

### Payment Functions

- `POST /.netlify/functions/payments-create-invoice` - Create payment invoice
- `POST /.netlify/functions/payments-webhook` - Handle payment webhooks
- `POST /.netlify/functions/moyasar-webhook` - Moyasar payment webhook
- `GET /.netlify/functions/invoices-list` - Get user invoices
- `POST /.netlify/functions/promo-redeem` - Redeem promo code

### Admin Functions

- `POST /.netlify/functions/admin-activate` - Manually activate subscription
- `POST /.netlify/functions/admin-announcement` - Create announcement
- `GET /.netlify/functions/admin-users-list` - Get users list

### AI Functions

- `POST /.netlify/functions/gemini-ethraa` - Generate Ethraa content
- `POST /.netlify/functions/gemini-mithaq` - Generate Mithaq content
- `POST /.netlify/functions/strategy` - Generate strategy

### Program Functions

- `POST /.netlify/functions/add-miyad-event` - Add event
- `DELETE /.netlify/functions/delete-miyad-event` - Delete event
- `POST /.netlify/functions/remind-miyad` - Send reminders
- `GET /.netlify/functions/mueen-plan` - Get peer support plan
- `POST /.netlify/functions/mulham` - Submit challenge
- `POST /.netlify/functions/murtakaz` - Focus tracking

### Utility Functions

- `POST /.netlify/functions/log-tool-usage` - Log tool usage
- `POST /.netlify/functions/storage-ensure` - Ensure storage bucket
- `GET /.netlify/functions/get-reminder-settings` - Get reminder settings
- `POST /.netlify/functions/save-reminder-settings` - Save reminder settings

---

## 🗄️ Database Schema

### Main Tables

**users**

- `id` (UUID, PK)
- `email` (TEXT, UNIQUE)
- `name` (TEXT)
- `avatar_url` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**memberships**

- `id` (UUID, PK)
- `user_sub` (TEXT)
- `email` (TEXT)
- `status` (TEXT: active, trial, inactive)
- `plan` (TEXT)
- `start_at` (TIMESTAMP)
- `end_at` (TIMESTAMP)
- `created_at` (TIMESTAMP)

**complaints**

- `id` (UUID, PK)
- `user_email` (TEXT)
- `user_name` (TEXT)
- `subject` (TEXT)
- `type` (TEXT: complaint, suggestion)
- `message` (TEXT)
- `status` (TEXT: new, in_progress, resolved, rejected)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**complaint_messages**

- `id` (UUID, PK)
- `complaint_id` (UUID, FK)
- `sender` (TEXT: user, admin)
- `body` (TEXT)
- `created_at` (TIMESTAMP)

**invoices**

- `id` (UUID, PK)
- `user_email` (TEXT)
- `amount` (INTEGER)
- `currency` (TEXT)
- `status` (TEXT)
- `gateway` (TEXT)
- `invoice_id` (TEXT)
- `created_at` (TIMESTAMP)

**user_prefs**

- `user_sub` (TEXT, PK)
- `display_name` (TEXT)
- `avatar_url` (TEXT)
- `theme_color` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

## 🔐 Authentication

### Auth0 Integration

- Uses Auth0 SPA SDK for client-side authentication
- JWT tokens for API authentication
- Role-based access control (admin, user)
- Custom claims namespace: `https://n-athar.co/`

### Authorization

- **Public routes**: Landing, pricing, policies
- **Protected routes**: Profile, programs, complaints
- **Admin routes**: Admin dashboard, user management

### Token Verification

- JWT tokens verified using JWKS
- Tokens include user email, roles, and custom claims
- Automatic token refresh

---

## 🎨 Styling & Design

### Design System

- **Color Scheme**: Blue primary (#1e40af), with dark mode support
- **Typography**: Cairo font for Arabic, system fonts for fallback
- **Spacing**: 8px base unit
- **Border Radius**: 12px standard
- **Shadows**: Subtle elevation shadows

### CSS Architecture

- **Global Styles**: `style.css`
- **Component Styles**: `assets/css/[component].css`
- **CSS Variables**: Theme colors, spacing, shadows
- **Dark Mode**: Automatic detection with manual toggle
- **Responsive**: Mobile-first approach with breakpoints at 480px, 640px, 768px

### Responsive Breakpoints

```css
/* Mobile: < 480px */
/* Tablet: 480px - 768px */
/* Desktop: > 768px */
/* Landscape: orientation: landscape */
```

---

## 💻 Development

### Local Development

```bash
# Start development server
netlify dev

# Watch for changes
# Server runs on http://localhost:8888
```

### File Organization

- Keep page-specific styles in `assets/css/[page].css`
- Keep page-specific scripts in `assets/js/[page].js`
- Use components for reusable HTML (`components/`)
- Use Netlify functions for backend logic

### Code Standards

- Use semantic HTML5
- Use CSS variables for theming
- Use ES6+ JavaScript
- Add comments for complex logic
- Test on mobile devices

### Testing

- Test on multiple devices (mobile, tablet, desktop)
- Test in light and dark modes
- Test with different screen orientations
- Test with slow network (DevTools throttling)

---

## 🚀 Deployment

### Automatic Deployment

- Push to main branch triggers automatic deployment
- Netlify builds and deploys automatically
- Environment variables configured in Netlify dashboard

### Manual Deployment

```bash
# Build and deploy
netlify deploy --prod

# Deploy specific directory
netlify deploy --prod --dir=.
```

### Pre-deployment Checklist

- ✅ All environment variables set
- ✅ Database migrations completed
- ✅ Auth0 configuration updated
- ✅ Moyasar webhook configured
- ✅ Email service configured
- ✅ All tests passing
- ✅ No console errors

---

## 📞 Support & Contact

- **Email**: team@n-athar.co
- **WhatsApp**: [Link in footer]
- **Complaints**: [Complaints page]

---

## 📝 License

All rights reserved © 2024 أثــر (Athar)

---

## 🤝 Contributing

For bug reports and feature requests, please use the complaints system or contact the team.

---

**Last Updated**: November 2024
**Version**: 1.0.0
