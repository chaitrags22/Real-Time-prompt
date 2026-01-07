const socket = io({
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    maxReconnectionAttempts: 5
});
const messagesDiv = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const promptInput = document.getElementById('promptInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const userList = document.getElementById('userList');
const userCount = document.getElementById('userCount');
const messageCount = document.getElementById('messageCount');
const typing = document.getElementById('typing');
const roomSelect = document.getElementById('roomSelect');
const statusSelect = document.getElementById('statusSelect');
const avatarSelect = document.getElementById('avatarSelect');
const privateMsg = document.getElementById('privateMsg');
const targetUser = document.getElementById('targetUser');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPanel = document.getElementById('emojiPanel');
const themeBtn = document.getElementById('themeBtn');
const soundBtn = document.getElementById('soundBtn');
const exportBtn = document.getElementById('exportBtn');
const userSearchBtn = document.getElementById('userSearchBtn');
const userSearchPanel = document.getElementById('userSearchPanel');
const userSearchInput = document.getElementById('userSearchInput');
const userSearchResults = document.getElementById('userSearchResults');
const mentionBtn = document.getElementById('mentionBtn');
const replyBtn = document.getElementById('replyBtn');
const shareScreenBtn = document.getElementById('shareScreenBtn');
const screenShareBtn = document.getElementById('screenShareBtn');
const screenShareModal = document.getElementById('screenShareModal');
const screenContainer = document.getElementById('screenContainer');
const startShareBtn = document.getElementById('startShareBtn');
const stopShareBtn = document.getElementById('stopShareBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const roleSelect = document.getElementById('roleSelect');
const roomName = document.getElementById('roomName');

let messageCounter = 0;
let typingTimer;
let currentUser = '';
let currentRoom = 'general';
let soundEnabled = true;
let darkTheme = false;
let allUsers = [];
let selectedMessage = null;
let screenStreams = new Map();
let isSharing = false;

function createVideoElement(userId) {
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.id = `screen-${userId}`;
    video.style.width = '100%';
    video.style.maxWidth = '400px';
    video.style.height = 'auto';
    video.style.borderRadius = '8px';
    video.style.background = '#000';
    video.style.margin = '10px';
    
    const label = document.createElement('div');
    label.textContent = userId;
    label.style.textAlign = 'center';
    label.style.color = '#1565c0';
    label.style.fontSize = '14px';
    label.style.marginBottom = '5px';
    
    const container = document.createElement('div');
    container.appendChild(label);
    container.appendChild(video);
    
    return { container, video };
}

async function startScreenShare() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true
        });
        
        let video = document.getElementById('screenVideo');
        if (!video) {
            video = document.createElement('video');
            video.id = 'screenVideo';
            video.autoplay = true;
            video.style.width = '100%';
            video.style.maxWidth = '800px';
            video.style.height = 'auto';
            video.style.borderRadius = '8px';
            video.style.background = '#000';
            screenContainer.appendChild(video);
        }
        
        video.srcObject = stream;
        isSharing = true;
        
    } catch (err) {
        alert('Screen sharing failed: ' + err.message);
    }
}

function stopScreenShare() {
    const userStream = screenStreams.get(currentUser);
    if (userStream) {
        userStream.stream.getTracks().forEach(track => track.stop());
        screenContainer.removeChild(userStream.container);
        screenStreams.delete(currentUser);
    }
    isSharing = false;
    socket.emit('screen-share-stop', { user: currentUser });
}

function addRemoteScreenShare(user) {
    if (!screenStreams.has(user)) {
        const { container, video } = createVideoElement(user);
        screenContainer.appendChild(container);
        screenStreams.set(user, { container, video });
    }
}

function removeRemoteScreenShare(user) {
    const userStream = screenStreams.get(user);
    if (userStream) {
        screenContainer.removeChild(userStream.container);
        screenStreams.delete(user);
    }
}

function searchUsers(query) {
    const filtered = allUsers.filter(user => 
        user.username.toLowerCase().includes(query.toLowerCase())
    );
    
    userSearchResults.innerHTML = '';
    filtered.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'search-result';
        const statusIcon = user.status === 'online' ? '🟢' : user.status === 'away' ? '🟡' : '🔴';
        userDiv.innerHTML = `${statusIcon} ${user.avatar} ${user.username}`;
        userDiv.onclick = () => selectUser(user);
        userSearchResults.appendChild(userDiv);
    });
}

function selectUser(user) {
    userInput.value = user.username;
    targetUser.value = user.username;
    userSearchPanel.style.display = 'none';
    promptInput.focus();
}

function mentionUser() {
    if (targetUser.value) {
        const mention = `@${targetUser.value} `;
        promptInput.value = mention + promptInput.value;
        promptInput.focus();
        promptInput.setSelectionRange(mention.length, mention.length);
    }
}

function replyToMessage() {
    if (selectedMessage) {
        const reply = `Reply to ${selectedMessage.user}: `;
        promptInput.value = reply + promptInput.value;
        promptInput.focus();
        promptInput.setSelectionRange(reply.length, reply.length);
        selectedMessage = null;
        document.querySelectorAll('.message.selected').forEach(m => m.classList.remove('selected'));
    }
}

function getRoleIcon(role) {
    const icons = {
        'user': '👤',
        'developer': '💻',
        'admin': '👑',
        'moderator': '🛡️',
        'guest': '👋'
    };
    return icons[role] || '👤';
}

function getRoleColor(role) {
    const colors = {
        'admin': '#ff5722',
        'developer': '#2196f3',
        'moderator': '#ff9800',
        'user': '#4caf50',
        'guest': '#9e9e9e'
    };
    return colors[role] || '#4caf50';
}

function openScreenModal() {
    if (!currentUser) {
        currentUser = userInput.value.trim() || 'Anonymous';
        socket.emit('user-join', { 
            username: currentUser, 
            room: currentRoom, 
            avatar: avatarSelect.value,
            role: roleSelect.value
        });
    }
    screenShareModal.style.display = 'flex';
}

function closeScreenModal() {
    console.log('Closing screen modal');
    document.getElementById('screenShareModal').style.display = 'none';
}

function playSound() {
    if (soundEnabled) {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
        audio.play().catch(() => {});
    }
}

function addMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.dataset.messageId = data.id;
    
    const userDiv = document.createElement('div');
    userDiv.className = 'user';
    const roleIcon = getRoleIcon(data.role);
    userDiv.innerHTML = `${data.avatar || '👤'} ${roleIcon} ${data.user}`;
    userDiv.style.color = getRoleColor(data.role);
    
    const promptDiv = document.createElement('div');
    promptDiv.className = 'prompt';
    promptDiv.textContent = `💭 ${data.prompt}`;
    
    const responseDiv = document.createElement('div');
    responseDiv.className = 'response';
    responseDiv.textContent = `🤖 ${data.response}`;
    
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'timestamp';
    timestampDiv.textContent = data.timestamp;
    
    const reactionsDiv = document.createElement('div');
    reactionsDiv.className = 'reactions';
    
    const reactionBtns = document.createElement('div');
    reactionBtns.className = 'reaction-buttons';
    ['👍', '❤️', '😂', '🔥'].forEach(emoji => {
        const btn = document.createElement('span');
        btn.textContent = emoji;
        btn.className = 'reaction-btn';
        btn.onclick = () => socket.emit('reaction', { messageId: data.id, emoji });
        reactionBtns.appendChild(btn);
    });
    
    messageDiv.appendChild(userDiv);
    messageDiv.appendChild(promptDiv);
    messageDiv.appendChild(responseDiv);
    messageDiv.appendChild(timestampDiv);
    messageDiv.appendChild(reactionsDiv);
    messageDiv.appendChild(reactionBtns);
    
    messageDiv.onclick = () => {
        document.querySelectorAll('.message.selected').forEach(m => m.classList.remove('selected'));
        messageDiv.classList.add('selected');
        selectedMessage = data;
    };
    
    if (data.isPrivate) {
        messageDiv.classList.add('private-message');
    }
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    messageCounter++;
    messageCount.textContent = `💬 ${messageCounter} messages`;
    playSound();
}

function updateReactions(data) {
    const messageDiv = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageDiv) {
        const reactionsDiv = messageDiv.querySelector('.reactions');
        reactionsDiv.innerHTML = '';
        Object.entries(data.reactions).forEach(([emoji, users]) => {
            if (users.length > 0) {
                const reactionSpan = document.createElement('span');
                reactionSpan.className = 'reaction';
                reactionSpan.textContent = `${emoji} ${users.length}`;
                reactionSpan.title = users.join(', ');
                reactionsDiv.appendChild(reactionSpan);
            }
        });
    }
}

function addNotification(text) {
    const notificationDiv = document.createElement('div');
    notificationDiv.className = 'notification';
    notificationDiv.textContent = text;
    messagesDiv.appendChild(notificationDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function updateUserList(users) {
    allUsers = users;
    userList.innerHTML = '';
    targetUser.innerHTML = '<option value="">Select user...</option>';
    
    users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        const statusIcon = user.status === 'online' ? '🟢' : user.status === 'away' ? '🟡' : '🔴';
        const roleIcon = getRoleIcon(user.role);
        userDiv.innerHTML = `${statusIcon} ${user.avatar} ${roleIcon} ${user.username}`;
        userDiv.style.borderLeft = `3px solid ${getRoleColor(user.role)}`;
        userDiv.onclick = () => selectUser(user);
        userList.appendChild(userDiv);
        
        if (user.username !== currentUser) {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = `${roleIcon} ${user.username}`;
            targetUser.appendChild(option);
        }
    });
    userCount.textContent = `👥 ${users.length} users`;
}

function sendPrompt() {
    const user = userInput.value.trim() || 'Anonymous';
    const prompt = promptInput.value.trim();
    
    if (prompt && user) {
        const messageData = {
            user: user,
            prompt: prompt,
            response: `Bot response to: ${prompt}`,
            timestamp: new Date().toLocaleTimeString(),
            avatar: avatarSelect.value,
            role: roleSelect.value,
            id: Date.now()
        };
        
        addMessage(messageData);
        promptInput.value = '';
        
        if (socket.connected) {
            socket.emit('prompt', messageData);
        }
    }
}

function clearChat() {
    messagesDiv.innerHTML = '';
    messageCounter = 0;
    messageCount.textContent = '💬 0 messages';
}

function toggleTheme() {
    darkTheme = !darkTheme;
    document.body.classList.toggle('dark-theme', darkTheme);
    themeBtn.textContent = darkTheme ? '☀️ Light' : '🎨 Theme';
}

function exportChat() {
    const messages = Array.from(document.querySelectorAll('.message')).map(msg => {
        return {
            user: msg.querySelector('.user').textContent,
            prompt: msg.querySelector('.prompt').textContent,
            response: msg.querySelector('.response').textContent,
            timestamp: msg.querySelector('.timestamp').textContent
        };
    });
    
    const dataStr = JSON.stringify(messages, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

// Event Listeners
sendBtn.addEventListener('click', sendPrompt);
clearBtn.addEventListener('click', clearChat);
themeBtn.addEventListener('click', toggleTheme);
exportBtn.addEventListener('click', exportChat);

soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔊 Sound' : '🔇 Muted';
});

emojiBtn.addEventListener('click', () => {
    emojiPanel.style.display = emojiPanel.style.display === 'block' ? 'none' : 'block';
});

document.querySelectorAll('.emoji').forEach(emoji => {
    emoji.addEventListener('click', () => {
        promptInput.value += emoji.dataset.emoji;
        emojiPanel.style.display = 'none';
        promptInput.focus();
    });
});

privateMsg.addEventListener('change', () => {
    targetUser.style.display = privateMsg.checked ? 'block' : 'none';
});

roomSelect.addEventListener('change', () => {
    const newRoom = roomSelect.value;
    if (newRoom !== currentRoom) {
        currentRoom = newRoom;
        socket.emit('change-room', newRoom);
        roomName.textContent = `🏠 ${newRoom.charAt(0).toUpperCase() + newRoom.slice(1)}`;
        messagesDiv.innerHTML = '';
        messageCounter = 0;
    }
});

statusSelect.addEventListener('change', () => {
    socket.emit('status-change', statusSelect.value);
});

userSearchBtn.addEventListener('click', () => {
    userSearchPanel.style.display = userSearchPanel.style.display === 'block' ? 'none' : 'block';
    if (userSearchPanel.style.display === 'block') {
        userSearchInput.focus();
        searchUsers('');
    }
});

userSearchInput.addEventListener('input', (e) => {
    searchUsers(e.target.value);
});

shareScreenBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({video: true});
        screenContainer.innerHTML = '<video autoplay style="width:100%;max-width:800px;"></video>';
        screenContainer.querySelector('video').srcObject = stream;
        screenShareModal.style.display = 'flex';
    } catch(e) {
        alert('Screen share failed');
    }
});

screenShareBtn.addEventListener('click', () => {
    console.log('Screen share sidebar button clicked');
    screenShareModal.style.display = 'flex';
    console.log('Modal display set to flex');
});

startShareBtn.addEventListener('click', async () => {
    console.log('Start share button clicked');
    await startScreenShare();
});
stopShareBtn.addEventListener('click', () => {
    console.log('Stop share button clicked');
    stopScreenShare();
});

closeModalBtn.addEventListener('click', () => {
    screenShareModal.style.display = 'none';
});

mentionBtn.addEventListener('click', mentionUser);
replyBtn.addEventListener('click', replyToMessage);

promptInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendPrompt();
    } else {
        clearTimeout(typingTimer);
        socket.emit('typing', { user: userInput.value.trim() || 'Anonymous' });
        typingTimer = setTimeout(() => {
            socket.emit('typing', { user: null });
        }, 1000);
    }
});

// Socket Events
socket.on('connect', () => {
    console.log('Connected to server');
    if (currentUser) {
        socket.emit('user-join', { 
            username: currentUser, 
            room: currentRoom, 
            avatar: avatarSelect.value 
        });
    }
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    addNotification('⚠️ Connection lost. Attempting to reconnect...');
});

socket.on('reconnect', () => {
    console.log('Reconnected to server');
    addNotification('✅ Reconnected to server');
});

socket.on('prompt-response', addMessage);
socket.on('user-list', updateUserList);
socket.on('user-notification', addNotification);
socket.on('message-history', (history) => {
    messagesDiv.innerHTML = '';
    messageCounter = 0;
    history.forEach(addMessage);
});
socket.on('user-typing', (data) => {
    if (data.user) {
        typing.textContent = `${data.user} is typing...`;
    }
});
socket.on('typing-stopped', (user) => {
    if (typing.textContent.includes(user)) {
        typing.textContent = '';
    }
});
socket.on('screen-share-start', (data) => {
    addNotification(`📺 ${data.user} started screen sharing`);
    addRemoteScreenShare(data.user);
});

socket.on('screen-share-stop', (data) => {
    addNotification(`📺 ${data.user} stopped screen sharing`);
    removeRemoteScreenShare(data.user);
});

socket.on('reaction-update', updateReactions);

promptInput.focus();