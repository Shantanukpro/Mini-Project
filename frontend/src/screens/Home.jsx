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
                        className={`w-full rounded-md border px-3 py-3 text-left transition ${isActive ? "border-blue-500 bg-blue-500/15" : "border-transparent hover:border-slate-700 hover:bg-slate-800"}`}
                        key={chat._id}
                        onClick={() => setActiveChatId(chat._id)}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-white">
                            {displayDeveloper(otherDeveloper)}
                          </span>
                          <span className="shrink-0 text-xs text-slate-500">
                            {formatTime(chat.lastMessage?.createdAt || chat.updatedAt)}
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
              <h2 className="text-lg font-semibold text-white">
                {activeChat ? displayDeveloper(getOtherDeveloper(activeChat)) : "Select a chat"}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {activeChat ? "Messages persist and sync live for both developers." : "Choose a thread from the sidebar to load history."}
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
            </div>

            <form onSubmit={sendMessage} className="border-t border-slate-800 p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  className="min-h-11 flex-1 rounded-md border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!activeChat || isSending}
                  onChange={(event) => setMessage(event.target.value)}
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
