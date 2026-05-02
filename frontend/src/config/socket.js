import { io } from "socket.io-client";

const socketUrl = import.meta.env.VITE_API_URL;

export function createSocket(token) {
  return io(socketUrl, {
    auth: { token },
    withCredentials: true,
    autoConnect: true,
  });
}
