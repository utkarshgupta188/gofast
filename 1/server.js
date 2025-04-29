const express = require('express');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (frontend)
app.use(express.static('frontend'));

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// WebSocket server
const wss = new WebSocketServer({ server });

const rooms = new Map(); // Map of room codes to WebSocket clients

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'create') {
      // Generate a unique 6-digit room code
      let roomCode;
      do {
        roomCode = Math.floor(100000 + Math.random() * 900000).toString();
      } while (rooms.has(roomCode));

      rooms.set(roomCode, [ws]); // Add the creator to the room
      ws.send(JSON.stringify({ type: 'room-created', roomCode }));
      console.log(`Room created: ${roomCode}`);
    } else if (data.type === 'join') {
      const { roomCode } = data;

      if (rooms.has(roomCode)) {
        rooms.get(roomCode).push(ws); // Add the peer to the room
        ws.send(JSON.stringify({ type: 'room-joined', roomCode }));

        // Notify all clients in the room
        rooms.get(roomCode).forEach((client) =>
          client.send(JSON.stringify({ type: 'peer-joined', roomCode }))
        );
        console.log(`Peer joined room: ${roomCode}`);
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid room code' }));
      }
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // Remove the client from all rooms
    for (const [roomCode, clients] of rooms.entries()) {
      const index = clients.indexOf(ws);
      if (index !== -1) {
        clients.splice(index, 1);
        if (clients.length === 0) {
          rooms.delete(roomCode); // Delete the room if empty
        }
        break;
      }
    }
  });
});
