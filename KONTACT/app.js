// 1. Парсим параметры из адресной строки, чтобы узнать, зашли мы по ссылке или создаем новую
const urlParams = new URLSearchParams(window.location.search);
let roomName = urlParams.get('room');
const isInitiator = !roomName; // Если в ссылке нет room, значит вы инициатор (создатель) созвона

// Если вы создатель — генерируем случайное секретное имя комнаты
if (isInitiator) {
    roomName = 'room-' + Math.random().toString(36).substring(2, 9);
    // Мягко обновляем ссылку в браузере, добавляя туда имя комнаты, но не перезагружая страницу
    window.history.pushState({}, '', `?room=${roomName}`);
}

const statusDiv = document.getElementById('status');
const actionBtn = document.getElementById('action-btn');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
let localStream;

// Префиксы для ролей, чтобы PeerJS понимал, кто кому звонит внутри одной комнаты
const myPeerId = isInitiator ? `${roomName}-host` : `${roomName}-guest`;
const targetPeerId = isInitiator ? `${roomName}-guest` : `${roomName}-host`;

// 2. Запрашиваем доступ к камере и микрофону
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
        
        // Подключаемся к сигнальному серверу PeerJS только ПОСЛЕ того, как дали доступ к камере
        initPeer();
    })
    .catch(err => {
        statusDiv.innerText = 'Ошибка: разрешите доступ к камере и микрофону!';
        alert('Для экстренной связи необходим доступ к камере.');
    });

function initPeer() {
    const peer = new Peer(myPeerId);

    peer.on('open', () => {
        if (isInitiator) {
            statusDiv.innerText = 'Комната создана. Отправьте ссылку собеседнику.';
            actionBtn.style.display = 'inline-block';
            actionBtn.innerText = 'Скопировать ссылку для СМС';
        } else {
            statusDiv.innerText = 'Подключение к организатору...';
            // Если зашел гость — он автоматически сразу звонит создателю
            const call = peer.call(targetPeerId, localStream);
            handleCall(call);
        }
    });

    // Обработка входящего звонка (срабатывает у создателя, когда гость переходит по ссылке)
    peer.on('call', (call) => {
        call.answer(localStream);
        handleCall(call);
    });

    peer.on('error', (err) => {
        console.error(err);
        if (err.type === 'peer-not-found') {
            statusDiv.innerText = 'Организатор еще не в сети. Ожидайте...';
            // Пробуем переподключиться через 3 секунды, если гость зашел раньше создателя
            setTimeout(initPeer, 3000);
        }
    });
}

function handleCall(call) {
    statusDiv.innerText = 'Связь установлена!';
    if (actionBtn) actionBtn.style.display = 'none'; // Скрываем кнопку копирования, она больше не нужна
    
    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
    });
}

// Логика кнопки копирования ссылки
actionBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href)
        .then(() => {
            actionBtn.innerText = 'Ссылка скопирована!';
            setTimeout(() => { actionBtn.innerText = 'Скопировать ссылку для СМС'; }, 2000);
        })
        .catch(() => {
            alert('Не удалось скопировать. Скопируйте адресную строку вручную: ' + window.location.href);
        });
});
