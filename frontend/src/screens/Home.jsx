import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "../config/axios";
import { createSocket } from "../config/socket";

function uniqueById(items) {
  return Array.from(new Map(items.map((item) => [item._id, item])).values());
}

function sortChats(chats) {
  return [...chats].sort((a, b) => {
    const aTime = new Date(a.lastMessage?.createdAt || a.updatedAt || a.createdAt).getTime();
    const bTime = new Date(b.lastMessage?.createdAt || b.updatedAt || b.createdAt).getTime();
    return bTime - aTime;
  });
}

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function displayDeveloper(user) {
  return user?.name || user?.email || "Developer";
}

const Home = () => {
  const token = useMemo(() => localStorage.getItem("authToken"), []);
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const activeChatIdRef = useRef(null);

  const [currentUser, setCurrentUser] = useState(() => {
    const storedUser = localStorage.getItem("authUser");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [developers, setDevelopers] = useState([]);
  const [selectedDeveloper, setSelectedDeveloper] = useState("");
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [socketStatus, setSocketStatus] = useState("offline");
  const [presenceMap, setPresenceMap] = useState({});
  const [typingStatus, setTypingStatus] = useState({});
  const typingTimeoutRef = useRef(null);

  const activeChat = chats.find((chat) => chat._id === activeChatId);

  function mergeChat(chat) {
    setChats((currentChats) => sortChats(uniqueById([chat, ...currentChats])));
  }

  function updateChatSummary(update) {
    setChats((currentChats) => sortChats(currentChats.map((chat) => (
      chat._id === update.chatId
        ? { ...chat, lastMessage: update.lastMessage, updatedAt: update.updatedAt }
        : chat
    ))));
  }

  function appendMessage(incomingMessage) {
    setMessages((currentMessages) => {
      if (currentMessages.some((item) => item._id === incomingMessage._id)) {
        return currentMessages;
      }

      return [...currentMessages, incomingMessage];
    });
  }

  // Remove a chat from local state and clear active view if needed
  function removeChat(chatId) {
    setChats((currentChats) => currentChats.filter((c) => c._id !== chatId));
    setActiveChatId((current) => (current === chatId ? "" : current));
    setMessages((current) => (activeChatIdRef.current === chatId ? [] : current));
  }

  function deleteChat(chatId) {
    if (!window.confirm("Delete this chat? It will be removed from your sidebar.")) return;

    axios
      .delete(`/chat/${chatId}`)
      .then(() => {
        removeChat(chatId);
      })
      .catch((err) => {
        setError(err.response?.data?.error || "Unable to delete chat.");
      });
  }

  function getOtherDeveloper(chat) {
    return chat?.participants?.find((participant) => participant._id !== currentUser?.id && participant._id !== currentUser?._id);
  }

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;

    Promise.all([
      axios.get("/users/profile"),
      axios.get("/users/developers"),
      axios.get("/chat"),
    ])
      .then(([profileRes, developersRes, chatsRes]) => {
        if (!isMounted) return;

        setCurrentUser(profileRes.data.user);
        localStorage.setItem("authUser", JSON.stringify(profileRes.data.user));
        setDevelopers(developersRes.data.users || []);
        setChats(sortChats(chatsRes.data.chats || []));
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem("authToken");
          localStorage.removeItem("authUser");
          navigate("/login");
          return;
        }

        setError(err.response?.data?.error || "Unable to load your chat workspace.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [navigate, token]);

  useEffect(() => {
    if (!token) return undefined;

    const socket = createSocket(token);
    socketRef.current = socket;

    socket.on("connect", () => setSocketStatus("live"));
    socket.on("disconnect", () => setSocketStatus("offline"));
    socket.on("connect_error", (err) => {
      setSocketStatus("offline");
      setError(err.message || "Real-time connection failed.");
    });
    socket.on("chat:created", mergeChat);
    socket.on("chat:updated", updateChatSummary);
    socket.on("message:new", (incomingMessage) => {
      if (incomingMessage.chat === activeChatIdRef.current) {
        appendMessage(incomingMessage);
      }
    });
    socket.on("chat:deleted", ({ chatId }) => {
      removeChat(chatId);
    });
    
    // Request initial online users
    socket.emit("presence:request_sync", (onlineUsers) => {
      setPresenceMap((prev) => {
        const next = { ...prev };
        onlineUsers.forEach((id) => {
          next[id] = { isOnline: true };
        });
        return next;
      });
    });

    socket.on("presence:update", ({ userId, isOnline, lastSeen }) => {
      setPresenceMap((prev) => ({
        ...prev,
        [userId]: { isOnline, lastSeen },
      }));
    });

    socket.on("typing:start", ({ chatId, userId }) => {
      setTypingStatus((prev) => ({ ...prev, [chatId]: userId }));
    });

    socket.on("typing:stop", ({ chatId, userId }) => {
      setTypingStatus((prev) => (prev[chatId] === userId ? { ...prev, [chatId]: null } : prev));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    if (!activeChatId || !token) {
      setMessages([]);
      return undefined;
    }

    const socket = socketRef.current;
    let isMounted = true;

    socket?.emit("chat:join", { chatId: activeChatId }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "Unable to join the chat room.");
      }
    });

    axios
      .get(`/chat/${activeChatId}/messages`)
      .then((res) => {
        if (isMounted) setMessages(res.data.messages || []);
      })
      .catch((err) => {
        setError(err.response?.data?.error || "Unable to load chat history.");
      });

    return () => {
      isMounted = false;
      socket?.emit("chat:leave", { chatId: activeChatId });
    };
  }, [activeChatId, token]);

  function createChat(event) {
    event.preventDefault();

    if (!selectedDeveloper) return;

    setError("");

    axios
      .post("/chat", { participantId: selectedDeveloper })
      .then((res) => {
        mergeChat(res.data.chat);
        setActiveChatId(res.data.chat._id);
        setSelectedDeveloper("");
      })
      .catch((err) => {
        setError(err.response?.data?.error || "Unable to create chat.");
      });
  }

  function sendMessage(event) {
    event.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage || !activeChatId || isSending) return;

    const clientMessageId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const payload = {
      chatId: activeChatId,
      content: trimmedMessage,
      clientMessageId,
    };

    setError("");
    setIsSending(true);
    setMessage("");

    // Clear typing timeout and explicitly stop typing
    clearTimeout(typingTimeoutRef.current);
    socketRef.current?.emit("typing:stop", { chatId: activeChatId });

    if (socketRef.current?.connected) {
      socketRef.current.emit("message:send", payload, (response) => {
        setIsSending(false);
        if (!response?.ok) {
          setError(response?.error || "Unable to send message.");
          setMessage(trimmedMessage);
        }
      });
      return;
    }

    axios
      .post(`/chat/${activeChatId}/messages`, {
        message: trimmedMessage,
        clientMessageId,
      })
      .then((res) => {
        (res.data.messages || []).forEach(appendMessage);
      })
      .catch((err) => {
        setError(err.response?.data?.error || "Unable to send message.");
        setMessage(trimmedMessage);
      })
      .finally(() => {
        setIsSending(false);
      });
  }

  function logout() {
    axios.post("/users/logout").finally(() => {
      localStorage.removeItem("authToken");
      localStorage.removeItem("authUser");
      navigate("/login");
    });
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <section className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-300">DevChat AI</p>
          <h1 className="mt-3 text-3xl font-bold">Sign in to open your developer chats.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Create one account per developer, start a direct chat, and use @ai inside the same thread.
          </p>
          <div className="mt-6 flex gap-3">
            <Link className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500" to="/login">
              Login
            </Link>
            <Link className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-emerald-400 hover:text-white" to="/register">
              Register
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-300">DevChat AI</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Developer Chat Platform</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={`rounded-md border px-3 py-2 ${socketStatus === "live" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-amber-500/40 bg-amber-500/10 text-amber-200"}`}>
              {socketStatus === "live" ? "Live sync" : "Offline fallback"}
            </span>
            <span className="rounded-md border border-slate-700 px-3 py-2 text-slate-300">
              {displayDeveloper(currentUser)}
            </span>
            <button onClick={logout} className="rounded-md border border-slate-700 px-3 py-2 text-slate-200 transition hover:border-red-400 hover:text-white" type="button">
              Logout
            </button>
          </div>
        </header>

        {error && (
          <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="grid flex-1 gap-5 py-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="flex min-h-[24rem] flex-col rounded-lg border border-slate-800 bg-slate-900">
            <form onSubmit={createChat} className="border-b border-slate-800 p-4">
              <label className="text-sm font-semibold text-slate-200" htmlFor="developer">
                Start a chat
              </label>
              <div className="mt-3 flex gap-2">
                <select
                  className="min-h-10 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  id="developer"
                  onChange={(event) => setSelectedDeveloper(event.target.value)}
                  value={selectedDeveloper}
                >
                  <option value="">Select developer</option>
                  {developers.map((developer) => (
                    <option key={developer._id} value={developer._id}>
                      {displayDeveloper(developer)}
                    </option>
                  ))}
                </select>
                <button className="min-h-10 rounded-md bg-emerald-500 px-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300" disabled={!selectedDeveloper} type="submit">
                  New
                </button>
              </div>
            </form>

            <div className="flex-1 overflow-y-auto p-2">
              {isLoading ? (
                <p className="px-3 py-4 text-sm text-slate-400">Loading chats...</p>
              ) : chats.length === 0 ? (
                <p className="px-3 py-4 text-sm leading-6 text-slate-400">
                  No chats yet. Select another developer to create the first thread.
                </p>
              ) : (
                <div className="space-y-2">
                  {chats.map((chat) => {
                    const otherDeveloper = getOtherDeveloper(chat);
                    const isActive = chat._id === activeChatId;

                    return (
                      <button
                        className={`group relative w-full rounded-md border px-3 py-3 text-left transition ${isActive ? "border-blue-500 bg-blue-500/15" : "border-transparent hover:border-slate-700 hover:bg-slate-800"}`}
                        key={chat._id}
                        onClick={() => setActiveChatId(chat._id)}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-white flex items-center gap-2">
                            {displayDeveloper(otherDeveloper)}
                            {presenceMap[otherDeveloper?._id]?.isOnline && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" title="Online" />
                            )}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="shrink-0 text-xs text-slate-500">
                              {formatTime(chat.lastMessage?.createdAt || chat.updatedAt)}
                            </span>
                            {/* Trash icon — visible on hover */}
                            <span
                              className="hidden shrink-0 cursor-pointer rounded p-1 text-slate-500 transition hover:bg-red-500/20 hover:text-red-400 group-hover:inline-flex"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteChat(chat._id);
                              }}
                              role="button"
                              tabIndex={0}
                              title="Delete chat"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-400">
                          {chat.lastMessage?.content || "Open thread"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-[36rem] flex-col rounded-lg border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2 text-lg font-semibold text-white">
                {activeChat ? displayDeveloper(getOtherDeveloper(activeChat)) : "Select a chat"}
                {activeChat && presenceMap[getOtherDeveloper(activeChat)?._id]?.isOnline && (
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" title="Online" />
                )}
              </div>
              <p className="mt-1 text-sm text-slate-400">
                {activeChat ? (
                  presenceMap[getOtherDeveloper(activeChat)?._id]?.isOnline 
                    ? "Online now" 
                    : `Last seen: ${formatTime(presenceMap[getOtherDeveloper(activeChat)?._id]?.lastSeen || getOtherDeveloper(activeChat)?.lastSeen) || 'Unknown'}`
                ) : "Choose a thread from the sidebar to load history."}
              </p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
              {!activeChat && (
                <div className="rounded-lg border border-dashed border-slate-700 p-6 text-sm leading-6 text-slate-400">
                  Create or open a chat to start real-time developer messaging. Use @ai in the composer for an assistant reply shared with everyone in the thread.
                </div>
              )}

              {activeChat && messages.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-700 p-6 text-sm leading-6 text-slate-400">
                  No messages yet. Send a message or try @ai explain this project architecture.
                </div>
              )}

              {messages.map((item) => {
                const senderId = item.sender?._id || item.sender;
                const isMine = senderId === currentUser?.id || senderId === currentUser?._id;
                const isAi = item.role === "ai";

                return (
                  <article
                    className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-6 ${isMine ? "ml-auto bg-blue-600 text-white" : isAi ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-50" : "border border-slate-700 bg-slate-800 text-slate-100"}`}
                    key={item._id}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs text-slate-300">
                      <span className="truncate font-medium">
                        {isAi ? "AI assistant" : isMine ? "You" : displayDeveloper(item.sender)}
                      </span>
                      <span className="shrink-0">{formatTime(item.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words">{item.content}</p>
                    {isAi && item.provider && (
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-emerald-200">
                        {item.provider}
                      </p>
                    )}
                  </article>
                );
              })}

              {activeChat && typingStatus[activeChatId] === getOtherDeveloper(activeChat)?._id && (
                <div className="flex animate-pulse items-center gap-2 text-sm italic text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {displayDeveloper(getOtherDeveloper(activeChat))} is typing...
                </div>
              )}
            </div>

            <form onSubmit={sendMessage} className="border-t border-slate-800 p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  className="min-h-11 flex-1 rounded-md border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!activeChat || isSending}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    if (!activeChatId || !socketRef.current?.connected) return;
                    
                    socketRef.current.emit("typing:start", { chatId: activeChatId });
                    clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(() => {
                      socketRef.current.emit("typing:stop", { chatId: activeChatId });
                    }, 2000);
                  }}
                  placeholder={activeChat ? "Message a developer, or type @ai explain this code" : "Open a chat to send a message"}
                  value={message}
                />
                <button
                  className="min-h-11 rounded-md bg-emerald-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                  disabled={!activeChat || !message.trim() || isSending}
                  type="submit"
                >
                  {isSending ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
};

export default Home;
