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

  console.log('WebSocket message received:', data);

  if (data.type === 'code') {
    roomIdSpan.textContent = data.code;
    roomInfo.classList.remove('hidden');
  } else if (data.type === 'peer-joined') {
    setupPeerConnection();
    roomContainer.style.display = 'none';
    chatContainer.style.display = 'block';
  } else if (data.type === 'offer') {
    console.log('Received offer:', data.offer);
    await handleOffer(data.offer);
  } else if (data.type === 'answer') {
    console.log('Received answer:', data.answer);
    await handleAnswer(data.answer);
  } else if (data.type === 'iceCandidate') {
    console.log('Received ICE candidate:', data.candidate);
    await handleIceCandidate(data.candidate);
  } else if (data.type === 'error') {
    console.error('Signaling error:', data.message);
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

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('Sending ICE candidate:', event.candidate);
      ws.send(JSON.stringify({ type: 'iceCandidate', candidate: event.candidate }));
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log('ICE Connection State:', peerConnection.iceConnectionState);
  };

  // Handle Data Channel
  peerConnection.ondatachannel = (event) => {
    console.log('Data channel received:', event.channel);
    dataChannel = event.channel;
    setupDataChannel();
  };

  // Create Data Channel
  dataChannel = peerConnection.createDataChannel('chat');
  setupDataChannel();

  // Create Offer
  peerConnection.createOffer()
    .then((offer) => {
      console.log('Created offer:', offer);
      peerConnection.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: 'offer', offer }));
    })
    .catch((error) => console.error('Error creating offer:', error));
}

async function handleOffer(offer) {
  peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  });

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('Sending ICE candidate:', event.candidate);
      ws.send(JSON.stringify({ type: 'iceCandidate', candidate: event.candidate }));
    }
  };

  peerConnection.ondatachannel = (event) => {
    console.log('Data channel received:', event.channel);
    dataChannel = event.channel;
    setupDataChannel();
  };

  console.log('Setting remote description with offer:', offer);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await peerConnection.createAnswer();
  console.log('Created answer:', answer);
  await peerConnection.setLocalDescription(answer);

  ws.send(JSON.stringify({ type: 'answer', answer }));
}

async function handleAnswer(answer) {
  console.log('Setting remote description with answer:', answer);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

async function handleIceCandidate(candidate) {
  try {
    console.log('Adding ICE candidate:', candidate);
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
  }
}

function setupDataChannel() {
  dataChannel.onopen = () => {
    console.log('Data channel opened');
    sendMessageBtn.disabled = false; // Enable Send button
    messagesTextarea.value += "Connection established. You can now send messages.\n";
  };

  dataChannel.onclose = () => {
    console.log('Data channel closed');
    sendMessageBtn.disabled = true; // Disable Send button
    messagesTextarea.value += "Connection closed. You cannot send messages.\n";
  };

  dataChannel.onmessage = (event) => {
    const data = event.data;
    if (typeof data === 'string') {
      messagesTextarea.value += `Peer: ${data}\n`;
    } else {
      // Handle received file
      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);
      messagesTextarea.value += `Peer sent a file: <a href="${url}" download="file">Download</a>\n`;
    }
  };

  sendMessageBtn.addEventListener('click', () => {
    const message = messageInput.value;
    console.log(`DataChannel State: ${dataChannel.readyState}`); // Log state
    if (dataChannel.readyState === 'open') {
      dataChannel.send(message);
      messagesTextarea.value += `You: ${message}\n`;
      messageInput.value = '';
    } else {
      alert('Connection is not ready. Please wait.');
    }
  });

  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = () => {
      console.log(`DataChannel State: ${dataChannel.readyState}`); // Log state
      if (dataChannel.readyState === 'open') {
        dataChannel.send(reader.result);
        messagesTextarea.value += `You sent a file: ${file.name}\n`;
      } else {
        alert('Connection is not ready. Please wait.');
      }
    };

    reader.readAsArrayBuffer(file);
  });
}
