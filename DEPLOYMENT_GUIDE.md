# Developer Chat Platform: Production Deployment Guide

This guide provides step-by-step instructions for deploying your Full-Stack Developer Chat Platform to production using Render for the Node.js backend and Vercel for the React frontend.

---

## Part A: Backend Deployment (Render)

Render is an excellent PaaS for hosting Node.js applications, especially those that require WebSockets (like Socket.io).

### 1. Create the Web Service
1. Sign up/Log in to [Render](https://render.com).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub/GitLab account and select your project repository.
4. Fill in the service details:
   - **Name**: `chat-platform-api` (or your preferred name)
   - **Root Directory**: `backend` (Important: Set this so Render knows where the backend code lives).
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start` (this uses the `"start": "node server.js"` script).

### 2. Configure Environment Variables
Scroll down to the **Environment Variables** section and add the following keys. 

> [!WARNING]
> Do NOT use `localhost` for any URLs here. Ensure there are no trailing slashes on your `CLIENT_URL`.

| Key | Value | Example |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | `production` |
| `PORT` | `3000` | `3000` |
| `MONGODB_URI` | Your production MongoDB connection string (e.g., from MongoDB Atlas). | `mongodb+srv://user:pass@cluster.mongodb.net/chatdb` |
| `JWT_SECRET` | A long, secure random string. | `your_super_secret_jwt_key_9876` |
| `GEMINI_API_KEY` | Your Google Gemini API Key. | `AIzaSy...` |
| `CLIENT_URL` | The URL where your Vercel frontend will live. *(You can set this to a temporary dummy URL, deploy the frontend, get the real URL, and come back to update this)*. | `https://your-app-name.vercel.app` |

### 3. Deploy
1. Click **Create Web Service**.
2. Render will begin building and deploying your app. 
3. Once successful, copy the **Render URL** (e.g., `https://chat-platform-api-xxxx.onrender.com`). You will need this for the frontend!

---

## Part B: Frontend Deployment (Vercel)

Vercel is optimized for Vite + React applications and provides lightning-fast static hosting.

### 1. Import Repository
1. Sign up/Log in to [Vercel](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your GitHub/GitLab repository.
4. In the configuration step:
   - **Project Name**: `chat-platform-web`
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` (Important: Click Edit and select the `frontend` folder).

### 2. Configure Environment Variables
Expand the **Environment Variables** section and add:

| Key | Value | Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | The Render URL you copied from Part A. | `https://chat-platform-api-xxxx.onrender.com` |

> [!IMPORTANT]
> Make sure `VITE_API_URL` does NOT end with a trailing slash (e.g., use `.onrender.com` not `.onrender.com/`).

### 3. Deploy
1. Click **Deploy**.
2. Vercel will run `npm run build` inside your frontend folder.
3. Once finished, you will be given your production domain (e.g., `https://chat-platform-web.vercel.app`).

### 4. Finalize Backend CORS
1. Take your new Vercel domain (`https://chat-platform-web.vercel.app`).
2. Go back to your Render Dashboard -> Environment Variables.
3. Update `CLIENT_URL` to match this exact Vercel domain.
4. **Save Changes** (Render will automatically redeploy the backend to apply the new CORS rule).

---

## Part C: Final Verification Checklist

Once both services are green and deployed, open your Vercel URL and run through this checklist:

- [ ] **Registration & Login**: Create a new account. Does it log in successfully?
- [ ] **CORS Verification**: Open browser dev tools (F12) -> Console. Are there any CORS red error messages? (If yes, double-check `CLIENT_URL` in Render).
- [ ] **Chat Creation**: Search for another user and start a new chat.
- [ ] **Real-time Messaging**: Open the app in two different browser windows (or incognito). Send a message. Does it appear instantly in the other window? (This verifies WebSockets are working).
- [ ] **AI Integration**: Type `/summarize` or `@ai explain React`. Does the AI respond?

> [!TIP]
> For local development moving forward, create a `.env.local` file inside the `frontend/` folder containing `VITE_API_URL=http://localhost:3000` so your local frontend still knows how to reach your local backend!
