const signalingServerUrl = `wss://gofast.onrender.com`;
const ws = new WebSocket(signalingServerUrl);

let peerConnection;
let dataChannel;

// UI Elements
const roomContainer = document.getElementById('room-container');
const chatContainer = document.getElementById('chat-container');
const roomCodeInput = document.getElementById('room-code');
const createRoomBtn = document.getElementById('create-room');
const joinRoomBtn = document.getElementById('join-room');
const messagesTextarea = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message');
const fileInput = document.getElementById('file-input');

// Create Room
createRoomBtn.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'create' }));
});

ws.onmessage = async (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'code') {
    alert(`Your room code is: ${data.code}`);
  } else if (data.type === 'peer-joined') {
    setupPeerConnection();
    roomContainer.style.display = 'none';
    chatContainer.style.display = 'block';
  } else if (data.type === 'error') {
    alert(data.message);
  }
};

// Join Room
joinRoomBtn.addEventListener('click', () => {
  const code = roomCodeInput.value.trim();

  if (!/^\d{6}$/.test(code)) {
    alert('Please enter a valid 6-digit code');
    return;
  }

  ws.send(JSON.stringify({ type: 'join', code }));
});

function setupPeerConnection() {
  peerConnection = new RTCPeerConnection();

  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    setupDataChannel();
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: 'iceCandidate', candidate: event.candidate }));
    }
  };

  dataChannel = peerConnection.createDataChannel('chat');
  setupDataChannel();
}

function setupDataChannel() {
  dataChannel.onmessage = (event) => {
    messagesTextarea.value += `Peer: ${event.data}\n`;
  };

  sendMessageBtn.addEventListener('click', () => {
    const message = messageInput.value;
    dataChannel.send(message);
    messagesTextarea.value += `You: ${message}\n`;
    messageInput.value = '';
  });

  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = () => {
      dataChannel.send(reader.result);
      messagesTextarea.value += `You sent a file: ${file.name}\n`;
    };

    reader.readAsArrayBuffer(file);
  });
}
