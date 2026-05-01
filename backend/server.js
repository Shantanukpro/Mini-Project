import  'dotenv/config';

import http from 'http';
import app from './app.js';
import { initSocket } from './services/socket.service.js';

const port = process.env.PORT || 3000;
const server = http.createServer(app);
const io = initSocket(server);

app.set('io', io);

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
