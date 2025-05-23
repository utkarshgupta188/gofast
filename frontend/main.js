const signalingServerUrl = `wss://gofast.onrender.com`; // Backend WebSocket URL
const ws = new WebSocket(signalingServerUrl);

let peerConnection;
let dataChannel;

// UI Elements
const roomInfo = document.getElementById('room-info');
const roomIdSpan = document.getElementById('room-id');
const roomContainer = document.getElementById('room-container');
const chatContainer = document.getElementById('chat-container');
const roomCodeInput = document.getElementById('room-code');
const createRoomBtn = document.getElementById('create-room');
const joinRoomBtn = document.getElementById('join-room');
const messagesTextarea = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message');
const fileInput = document.getElementById('file-input');

// Initially disable the Send button
sendMessageBtn.disabled = true;

// Create Room
createRoomBtn.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'create' }));
});

ws.onmessage = async (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'code') {
    roomIdSpan.textContent = data.code;
    roomInfo.classList.remove('hidden');
  } else if (data.type === 'peer-joined') {
    setupPeerConnection();
    roomContainer.style.display = 'none';
    chatContainer.style.display = 'block';
  } else if (data.type === 'offer') {
    await handleOffer(data.offer);
  } else if (data.type === 'answer') {
    await handleAnswer(data.answer);
  } else if (data.type === 'iceCandidate') {
    await handleIceCandidate(data.candidate);
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
  peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" } // Free Google STUN server
    ]
  });

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: 'iceCandidate', candidate: event.candidate }));
    }
  };

  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    setupDataChannel();
  };

  dataChannel = peerConnection.createDataChannel('chat');
  setupDataChannel();

  peerConnection.createOffer().then((offer) => {
    peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', offer }));
  });
}

async function handleOffer(offer) {
  peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  });

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: 'iceCandidate', candidate: event.candidate }));
    }
  };

  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    setupDataChannel();
  };

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  ws.send(JSON.stringify({ type: 'answer', answer }));
}

async function handleAnswer(answer) {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

async function handleIceCandidate(candidate) {
  await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

function setupDataChannel() {
  dataChannel.onopen = () => {
    sendMessageBtn.disabled = false;
    messagesTextarea.value += "Connection established. You can now send messages.\n";
  };

  dataChannel.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'text') {
        messagesTextarea.value += `Peer: ${data.content}\n`;
      } else if (data.type === 'file') {
        console.log('File metadata received:', data);
      }
    } catch (e) {
      const blob = new Blob([event.data]);
      const url = URL.createObjectURL(blob);
      messagesTextarea.value += `Peer sent a file: <a href="${url}" download="file">Download</a>\n`;
    }
  };

  sendMessageBtn.addEventListener('click', () => {
    const message = messageInput.value;
    if (dataChannel.readyState === 'open') {
      const messagePayload = { type: 'text', content: message };
      dataChannel.send(JSON.stringify(messagePayload));
      messagesTextarea.value += `You: ${message}\n`;
      messageInput.value = '';
    } else {
      alert('Connection is not ready.');
    }
  });

  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = () => {
      if (dataChannel.readyState === 'open') {
        const fileMetadata = {
          type: 'file',
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        };
        dataChannel.send(JSON.stringify(fileMetadata));
        dataChannel.send(reader.result);
        messagesTextarea.value += `You sent a file: ${file.name}\n`;
      } else {
        alert('Connection is not ready.');
      }
    };

    reader.readAsArrayBuffer(file);
  });
}
