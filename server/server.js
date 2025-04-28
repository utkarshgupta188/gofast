const express = require('express');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (frontend)
app.use(express.static('frontend'));

const server = app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

// WebSocket signaling server
const wss = new WebSocketServer({ server });

// Map to store 6-digit codes and WebSocket connections
const codeToSocketMap = new Map();

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'create') {
      // Generate a unique 6-digit code
      let code;
      do {
        code = Math.floor(100000 + Math.random() * 900000).toString();
      } while (codeToSocketMap.has(code));

      // Map the code to the client's WebSocket
      codeToSocketMap.set(code, ws);

      // Send the code back to the client
      ws.send(JSON.stringify({ type: 'code', code }));
      console.log(`Room created with code: ${code}`);
    } else if (data.type === 'join') {
      const { code } = data;

      if (codeToSocketMap.has(code)) {
        const hostSocket = codeToSocketMap.get(code);

        // Link the two clients
        hostSocket.send(JSON.stringify({ type: 'peer-joined' }));
        ws.send(JSON.stringify({ type: 'peer-joined' }));

        // Relay messages between the two clients
        hostSocket.on('message', (hostMessage) => {
          ws.send(hostMessage);
        });

        ws.on('message', (peerMessage) => {
          hostSocket.send(peerMessage);
        });

        // Remove the code from the map after the connection is established
        codeToSocketMap.delete(code);
        console.log(`Room with code ${code} is now connected`);
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid code' }));
      }
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});
