# Athar React Application

> React-based frontend for the Athar educational AI platform, migrated from vanilla HTML/CSS/JS.

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Authentication](#-authentication)
- [API Integration](#-api-integration)
- [Adding New Pages](#-adding-new-pages)
- [Adding New Tools](#-adding-new-tools)
- [State Management](#-state-management)
- [Styling Guide](#-styling-guide)
- [Deployment](#-deployment)

---

## 🛠 Tech Stack

| Technology          | Purpose                 | Version |
| ------------------- | ----------------------- | ------- |
| **React**           | UI Framework            | 19.x    |
| **Vite**            | Build Tool              | 7.x     |
| **TanStack Query**  | Server State Management | 5.x     |
| **React Hook Form** | Form Handling           | 7.x     |
| **Zod**             | Schema Validation       | 4.x     |
| **React Router**    | Client-side Routing     | 7.x     |
| **Tailwind CSS**    | Styling                 | 4.x     |
| **shadcn/ui**       | UI Components           | Latest  |
| **Auth0**           | Authentication          | 2.x     |
| **Supabase**        | Database Client         | 2.x     |

---

## 📁 Project Structure

```
athar-react/
├── public/                    # Static assets
├── src/
│   ├── components/
│   │   ├── ui/               # shadcn/ui components (auto-generated)
│   │   │   ├── button.jsx
│   │   │   ├── card.jsx
│   │   │   ├── dialog.jsx
│   │   │   ├── form.jsx
│   │   │   ├── input.jsx
│   │   │   ├── label.jsx
│   │   │   ├── select.jsx
│   │   │   ├── sonner.jsx    # Toast notifications
│   │   │   ├── textarea.jsx
│   │   │   └── dropdown-menu.jsx
│   │   └── layout/           # Layout components (Navbar, Footer, etc.)
│   │
│   ├── features/             # Feature-based modules
│   │   ├── auth/
│   │   │   ├── AuthProvider.jsx    # Auth0 provider & hooks
│   │   │   └── ProtectedRoute.jsx  # Route guards
│   │   ├── tools/            # AI tool components (Athar, Darsi, etc.)
│   │   └── admin/            # Admin panel components
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── useUserStatus.js  # Subscription status hook
│   │   └── useTheme.js       # Dark/light mode hook
│   │
│   ├── services/             # API & external service clients
│   │   ├── api.js            # Netlify Functions API client
│   │   └── supabase.js       # Supabase client
│   │
│   ├── pages/                # Page components (route targets)
│   │   └── Home.jsx          # Landing page
│   │
│   ├── contexts/             # React Context providers
│   ├── lib/
│   │   └── utils.js          # Utility functions (cn, etc.)
│   │
│   ├── App.jsx               # Root component with providers
│   ├── main.jsx              # Entry point
│   └── index.css             # Global styles + Tailwind
│
├── .env.local                # Environment variables (DO NOT COMMIT)
├── .env.example              # Environment template
├── components.json           # shadcn/ui configuration
├── vite.config.js            # Vite configuration
├── jsconfig.json             # Path aliases (@/)
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Navigate to project
cd athar-react

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start development server
npm run dev
```

### Available Scripts

| Command           | Description                              |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Start dev server (http://localhost:5173) |
| `npm run build`   | Build for production                     |
| `npm run preview` | Preview production build                 |
| `npm run lint`    | Run ESLint                               |

---

## 🔐 Environment Variables

Create `.env.local` from `.env.example`:

```env
# Auth0 (Client-side)
VITE_AUTH0_DOMAIN=your-domain.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=https://api.n-athar
VITE_AUTH0_CALLBACK_URL=http://localhost:5173/profile
VITE_AUTH0_LOGOUT_URL=http://localhost:5173

# Supabase (Anon key only - service role stays in Netlify)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# API
VITE_API_BASE_URL=http://localhost:8888/.netlify/functions
VITE_SITE_URL=http://localhost:5173

# Feature Flags
VITE_ENABLE_DEVTOOLS=true
```

> ⚠️ **Security**: Never expose `SUPABASE_SERVICE_ROLE`, `AUTH0_CLIENT_SECRET`, or API keys in the frontend. These stay in Netlify Functions.

---

## 🔑 Authentication

### Auth0 Provider

The app uses Auth0 for authentication. The provider is set up in `App.jsx`:

```jsx
// src/App.jsx
import { AuthProvider } from "@/features/auth/AuthProvider";

function App() {
  return <AuthProvider>{/* Your routes */}</AuthProvider>;
}
```

### Using Authentication

```jsx
import { useAuth } from "@/features/auth/AuthProvider";

function MyComponent() {
  const {
    isAuthenticated, // Boolean
    isLoading, // Boolean
    user, // User object
    loginWithRedirect,
    logout,
    getAccessToken, // For API calls
    isAdmin, // Check admin role
  } = useAuth();

  const handleLogin = () => {
    loginWithRedirect();
  };

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };
}
```

### Route Protection

Three types of protected routes are available:

```jsx
import { ProtectedRoute, SubscriptionRoute, AdminRoute } from '@/features/auth/ProtectedRoute'

// Login required only
<Route path="/profile" element={
  <ProtectedRoute>
    <ProfilePage />
  </ProtectedRoute>
} />

// Login + Active subscription required
<Route path="/athar" element={
  <SubscriptionRoute>
    <AtharPage />
  </SubscriptionRoute>
} />

// Login + Admin role required
<Route path="/admin" element={
  <AdminRoute>
    <AdminPage />
  </AdminRoute>
} />
```

---

## 📡 API Integration

### Using the API Client

```jsx
import { apiRequest, checkUserStatus, generateStrategy } from "@/services/api";
import { useAuth } from "@/features/auth/AuthProvider";

function MyComponent() {
  const { getAccessToken } = useAuth();

  // Generic API call
  const fetchData = async () => {
    const data = await apiRequest(
      "my-endpoint",
      {
        method: "POST",
        body: JSON.stringify({ foo: "bar" }),
      },
      getAccessToken,
    );
  };

  // Pre-built function
  const checkStatus = async () => {
    const status = await checkUserStatus(getAccessToken);
    console.log(status.active); // true/false
  };
}
```

### With React Query

```jsx
import { useQuery, useMutation } from "@tanstack/react-query";
import { generateStrategy } from "@/services/api";

function StrategyTool() {
  const { getAccessToken } = useAuth();

  // Query
  const { data, isLoading } = useQuery({
    queryKey: ["userStatus"],
    queryFn: () => checkUserStatus(getAccessToken),
  });

  // Mutation
  const mutation = useMutation({
    mutationFn: (params) => generateStrategy(params, getAccessToken),
    onSuccess: (data) => {
      console.log("Strategy generated:", data);
    },
  });

  const handleSubmit = (formData) => {
    mutation.mutate(formData);
  };
}
```

---

## ➕ Adding New Pages

### 1. Create the Page Component

```jsx
// src/pages/Programs.jsx
export default function ProgramsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1>البرامج</h1>
    </div>
  );
}
```

### 2. Add the Route

```jsx
// src/App.jsx
import ProgramsPage from "@/pages/Programs";

<Routes>
  <Route path="/programs" element={<ProgramsPage />} />
</Routes>;
```

---

## 🔧 Adding New Tools

### 1. Create Tool Component

```jsx
// src/features/tools/AtharTool.jsx
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthProvider";
import { generateStrategy } from "@/services/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AtharTool() {
  const { getAccessToken } = useAuth();
  const [result, setResult] = useState(null);

  const mutation = useMutation({
    mutationFn: (params) => generateStrategy(params, getAccessToken),
    onSuccess: (data) => {
      setResult(data);
      toast.success("تم إنشاء الاستراتيجية بنجاح");
    },
    onError: (error) => {
      toast.error("حدث خطأ: " + error.message);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({
      stage: "secondary",
      subject: "Math",
      lesson: "Algebra",
    });
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {/* Form fields */}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "جاري التوليد..." : "توليد الاستراتيجية"}
        </Button>
      </form>

      {result && <div className="mt-4">{/* Display result */}</div>}
    </div>
  );
}
```

### 2. Create Page Wrapper

```jsx
// src/pages/Athar.jsx
import AtharTool from "@/features/tools/AtharTool";

export default function AtharPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">منطلق</h1>
      <AtharTool />
    </div>
  );
}
```

### 3. Add API Function (if needed)

```jsx
// src/services/api.js
export async function generateAthar(params, getAccessToken) {
  return apiRequest(
    "strategy",
    {
      method: "POST",
      body: JSON.stringify(params),
    },
    getAccessToken,
  );
}
```

### 4. Add Protected Route

```jsx
// src/App.jsx
<Route
  path="/athar"
  element={
    <SubscriptionRoute>
      <AtharPage />
    </SubscriptionRoute>
  }
/>
```

---

## 📊 State Management

### Server State (React Query)

Used for data from APIs:

```jsx
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ["uniqueKey"],
  queryFn: fetchFunction,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### Client State (useState/useReducer)

Used for UI state:

```jsx
const [isOpen, setIsOpen] = useState(false);
const [formData, setFormData] = useState({ name: "", email: "" });
```

### Global State (Context)

Used for app-wide state like theme:

```jsx
// Using the theme hook
const { isDark, toggleTheme } = useTheme();
```

---

## 🎨 Styling Guide

### Tailwind Classes

Use standard Tailwind classes:

```jsx
<div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
  <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-400">Title</h1>
</div>
```

### shadcn/ui Components

```jsx
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

<Button variant="outline" size="lg">Click me</Button>
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

### Adding New shadcn Components

```bash
npx shadcn@latest add avatar badge table tabs
```

### Toast Notifications

```jsx
import { toast } from "sonner";

toast.success("تم بنجاح!");
toast.error("حدث خطأ");
toast.info("معلومة");
```

---

## 🚢 Deployment

### Build for Production

```bash
npm run build
```

### Netlify Configuration

Create `netlify.toml` in project root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Environment Variables

Set these in Netlify Dashboard → Site Settings → Environment Variables:

- All `VITE_*` variables from `.env.local`
- Update URLs to production domains

---

## 📚 Key Files Reference

| File                                   | Purpose                            |
| -------------------------------------- | ---------------------------------- |
| `src/App.jsx`                          | Main app with providers and routes |
| `src/features/auth/AuthProvider.jsx`   | Auth0 integration                  |
| `src/features/auth/ProtectedRoute.jsx` | Route guards                       |
| `src/services/api.js`                  | API client for Netlify Functions   |
| `src/services/supabase.js`             | Supabase client                    |
| `src/hooks/useUserStatus.js`           | Subscription status hook           |
| `src/hooks/useTheme.js`                | Theme management                   |
| `src/index.css`                        | Tailwind config + global styles    |

---

## 🔗 Related Resources

- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [TanStack Query](https://tanstack.com/query/latest)
- [React Hook Form](https://react-hook-form.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Auth0 React SDK](https://auth0.github.io/auth0-react/)
- [Supabase JS](https://supabase.com/docs/reference/javascript)
