# Developer Chat Platform with AI Integration

A demo-ready real-time chat platform for developers. Users can register, start one-to-one chats with other developers, exchange live messages over WebSockets, and call the AI assistant inside the same shared thread with an `@ai` message.

The current implementation is Node.js/Express on the backend and React/Vite on the frontend. The project prompt mentions Python, but this repository contains a JavaScript backend, so the audit refined the stack already present instead of rewriting it.

## Key Features

- Developer-to-developer chat creation with participant assignment
- Dashboard chat list scoped to the logged-in user
- Full persisted chat history on thread open
- Socket.IO real-time messaging with one room per chat
- `@ai` trigger inside normal chats, with AI replies broadcast to both users
- MongoDB persistence for users, chats, and messages
- JWT authentication with HTTP-only cookie support and bearer token fallback
- Optional Redis logout token blacklist
- Gemini integration with local fallback responses for credential-free demos

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, Axios, Socket.IO Client
- Backend: Node.js, Express, Socket.IO, MongoDB, Mongoose
- Auth: bcryptjs, JSON Web Tokens, cookies
- AI: Gemini API, local fallback when no API key is configured
- Optional: Redis for logout token blacklisting

## Setup

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd ../frontend
npm install
```

Create local environment files:

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

Start MongoDB locally, then run the backend:

```bash
cd backend
npm run dev
```

Run the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`.

## Environment Variables

Backend `backend/.env`:

```env
PORT=3000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/developer_chat_ai
MONGODB_SERVER_SELECTION_TIMEOUT_MS=5000
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=24h
GEMINI_API_KEY=YOUR_API_KEY
GEMINI_MODEL=gemini-2.5-flash
REDIS_URL=
```

Frontend `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
```

`GEMINI_API_KEY` is optional for demos. If it is missing or set to `YOUR_API_KEY`, the backend returns a deterministic local AI response.

## How Real-Time Chat Works

1. The frontend authenticates with the JWT and opens a Socket.IO connection.
2. The backend validates the socket token and joins the user to a private `user:<id>` room.
3. When a user opens a chat, the frontend emits `chat:join`; the backend verifies membership and joins `chat:<chatId>`.
4. New messages are saved to MongoDB first, then broadcast to the chat room as `message:new`.
5. Chat list summaries are updated with `chat:created` and `chat:updated` events.
6. If a message starts with `@ai`, the backend generates an AI reply, saves it as a normal chat message, and broadcasts it to the same room.

## Demo Flow

1. Register two users in separate browsers or profiles.
2. User A selects User B from the developer picker and creates a chat.
3. User B sees the chat appear on their dashboard after login, or instantly if already online.
4. Either user opens the chat and sends a message.
5. Both users see the message live without refreshing.
6. Send `@ai explain this code` to add an AI response visible to both users.

## Useful Scripts

Backend:

```bash
npm start
npm run dev
npm run check
```

Frontend:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Future Scope

- Add WebContainer-powered code execution rooms for collaborative coding
- Add typing indicators and read receipts
- Add group chats and role-based project channels
- Add file/code snippet attachments
- Add automated integration tests for Socket.IO events
- Add production Socket.IO scaling with a Redis adapter
