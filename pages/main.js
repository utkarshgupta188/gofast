const ws = new WebSocket('wss://gofast.onrender.com'); // WebSocket server URL
const client = new WebTorrent(); // WebTorrent client

// UI Elements
const roomInfo = document.getElementById('room-info');
const roomCodeSpan = document.getElementById('room-code');
const roomContainer = document.getElementById('room-container');
const chatContainer = document.getElementById('chat-container');
const roomCodeInput = document.getElementById('room-code-input');
const createRoomBtn = document.getElementById('create-room');
const joinRoomBtn = document.getElementById('join-room');
const messagesTextarea = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message');
const fileInput = document.getElementById('file-input');
const magnetLinksContainer = document.getElementById('magnet-links');

// Create Room
createRoomBtn.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'create' }));
});

// Join Room
joinRoomBtn.addEventListener('click', () => {
  const roomCode = roomCodeInput.value.trim();
  if (!/^\d{6}$/.test(roomCode)) {
    alert('Invalid room code');
    return;
  }
  ws.send(JSON.stringify({ type: 'join', roomCode }));
});

// WebSocket Messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'room-created') {
    roomCodeSpan.textContent = data.roomCode;
    roomInfo.classList.remove('hidden');
  } else if (data.type === 'room-joined') {
    roomContainer.style.display = 'none';
    chatContainer.style.display = 'block';
  } else if (data.type === 'peer-joined') {
    messagesTextarea.value += 'A peer has joined the room.\n';
  } else if (data.type === 'message') {
    // Display received message
    messagesTextarea.value += `Peer: ${data.content}\n`;
  }
};

// File Sharing
fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    client.seed(file, (torrent) => {
      const magnetLink = torrent.magnetURI;
      const link = document.createElement('a');
      link.href = magnetLink;
      link.textContent = `Download ${file.name}`;
      magnetLinksContainer.appendChild(link);
      magnetLinksContainer.appendChild(document.createElement('br'));

      // Broadcast magnet link to peers
      ws.send(JSON.stringify({ type: 'magnet', magnetLink }));
      messagesTextarea.value += `You shared a file: ${file.name}\n`;
    });
  }
});

// Messaging
sendMessageBtn.addEventListener('click', () => {
  const message = messageInput.value.trim();
  if (message) {
    messagesTextarea.value += `You: ${message}\n`;
    ws.send(JSON.stringify({ type: 'message', content: message }));
    messageInput.value = '';
  }
});
