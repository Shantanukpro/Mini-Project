# Project Overview

## What This Project Does

This is a developer-focused real-time chat platform with AI assistance built into the conversation. It is not a standalone chatbot. Developers can create direct chats with other registered users, exchange live messages, reload complete message history after login, and call the AI assistant in the same thread by starting a message with `@ai`.

## Architecture

```text
React Frontend
  | Axios REST calls: auth, chat creation, history loading
  | Socket.IO events: live chat creation and messages
  v
Express Backend
  | Auth middleware validates JWT
  | Chat controllers expose REST fallbacks
  | Socket handlers manage user rooms and chat rooms
  v
MongoDB
  | users
  | chats
  | messages
  v
AI Service
  | Gemini when configured
  | local fallback for interview demos
```

## Main Modules

- `frontend/src/screens/Home.jsx`: dashboard, chat list, developer picker, message thread, and live socket integration.
- `frontend/src/config/axios.jsx`: shared API client.
- `frontend/src/config/socket.js`: Socket.IO client factory.
- `backend/routes/chat.routes.js`: authenticated REST routes for chats and messages.
- `backend/controllers/chat.controller.js`: chat creation, history loading, and HTTP message fallback.
- `backend/services/chat.service.js`: persistence and validation for chats/messages.
- `backend/services/socket.service.js`: WebSocket authentication, rooms, broadcasting, and `@ai` handling.
- `backend/services/ai.service.js`: Gemini integration plus local fallback response.
- `backend/models/chat.model.js`: chat participants and last-message summary.
- `backend/models/message.model.js`: persisted chat messages.

## Chat Flow

1. A logged-in user opens the dashboard.
2. The frontend loads `/users/developers` and `/chat`.
3. The user selects another developer and posts to `POST /chat`.
4. The backend creates or returns the existing one-to-one chat.
5. The backend emits `chat:created` to both users' private rooms.
6. When either user opens the chat, the frontend emits `chat:join`.
7. The backend verifies that the socket user belongs to the chat before joining `chat:<chatId>`.
8. The frontend loads full history from `GET /chat/:chatId/messages`.

## Real-Time Message Flow

1. The sender emits `message:send` with `chatId`, `content`, and a client message id.
2. The backend verifies chat membership.
3. The message is saved to MongoDB.
4. The backend broadcasts `message:new` to `chat:<chatId>`.
5. The backend broadcasts `chat:updated` so sidebars show the latest message.
6. Duplicate client message ids are ignored, preventing accidental double sends during retries.

## AI Flow

1. A developer sends a message such as `@ai explain this code`.
2. The backend stores that user message like any other chat message.
3. The backend detects the `@ai` prefix and extracts the prompt.
4. The AI service calls Gemini if configured, otherwise it returns a local demo reply.
5. The AI reply is stored as a message with role `ai`.
6. The AI message is broadcast to the same chat room so both developers see it live.

## Key Challenges Solved

- Chat visibility for both participants: chats are stored with both user ids and emitted to each user's private room.
- Multi-user consistency: every socket must pass membership checks before joining a chat room.
- Real-time reliability: messages are persisted before broadcasting, so refreshes and reconnects recover the full thread.
- Duplicate prevention: client message ids are indexed per chat and reused sends return the existing message.
- Demo resilience: AI has a local fallback when Gemini credentials are unavailable.

## Interview Talking Points

- The system uses REST for durable operations such as loading chats and history, and WebSockets for low-latency live updates.
- Socket.IO rooms map naturally to chat ids, which keeps broadcasts scoped to the right participants.
- The AI assistant is treated as another message producer, so AI responses remain persistent, auditable, and visible to all chat members.
- The backend keeps chat logic, AI logic, and socket logic in separate modules to make the code easier to explain and extend.
  