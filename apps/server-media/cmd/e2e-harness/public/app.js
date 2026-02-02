const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const logDiv = document.getElementById('logs');
const btnJoin = document.getElementById('btnJoin');

function log(msg, type = '') {
    if (!logDiv) {
        console.log(`[LOG] ${msg}`);
        return;
    }
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const logItem = document.createElement('div');

    let colorClass = '';
    if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed')) colorClass = 'log-error';
    if (msg.toLowerCase().includes('success') || msg.toLowerCase().includes('complete')) colorClass = 'log-success';

    logItem.innerHTML = `<span class="log-time">[${time}]</span> <span class="${colorClass}">${msg}</span>`;
    logDiv.appendChild(logItem);
    logDiv.scrollTop = logDiv.scrollHeight;
    console.log(`[${time}] ${msg}`);
}

let pc;
let localStream;

async function updateTracks(newStream) {
    if (!pc || pc.connectionState === 'closed') return; // Early return if no connection

    const senders = pc.getSenders();
    let negotiationNeeded = false;

    for (const track of newStream.getTracks()) {
        const sender = senders.find(s => s.track && s.track.kind === track.kind);
        if (sender) {
            log(`Replacing ${track.kind} track...`);
            await sender.replaceTrack(track);
            // Ensure direction is sendrecv
            const transceiver = pc.getTransceivers().find(t => t.sender === sender);
            if (transceiver) transceiver.direction = 'sendrecv';
        } else {
            log(`Adding new ${track.kind} track...`);
            pc.addTrack(track, newStream);
            negotiationNeeded = true;
            // Force direction for new transceivers
            pc.getTransceivers().forEach(t => {
                if (t.sender.track === track) t.direction = 'sendrecv';
            });
        }
    }

    if (negotiationNeeded) {
        negotiate();
    }
}

async function startCamera() {
    try {
        if (localStream) {
            // Stop existing tracks to release hardware
            localStream.getTracks().forEach(t => t.stop());
        }
        localStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
        if (localVideo) localVideo.srcObject = localStream;
        log('Camera acquisition success');
        if (btnJoin) btnJoin.disabled = false;

        // Dynamic Switch Support
        if (pc && pc.connectionState !== 'closed') {
            await updateTracks(localStream);
        }
    } catch (e) {
        log(`Camera Error: ${e.message}`, 'error');
    }
}

async function startScreenShare() {
    try {
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
        }
        localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        if (localVideo) localVideo.srcObject = localStream;
        log('Screen Share acquisition success');
        if (btnJoin) btnJoin.disabled = false;

        // Dynamic Switch Support
        if (pc && pc.connectionState !== 'closed') {
            await updateTracks(localStream);
        }
    } catch (e) {
        log(`Screen Share Error: ${e.message}`, 'error');
    }
}

async function joinRoom() {
    const roomIdInput = document.getElementById('roomId');
    const userIdInput = document.getElementById('userId');
    if (!roomIdInput || !userIdInput) {
        log('Room ID or User ID input not found.', 'error');
        return;
    }

    const roomId = roomIdInput.value;
    const userId = userIdInput.value;

    // Check for Observer Mode
    const isObserver = !localStream;
    log(isObserver ? `Joining as Guest Observer...` : `Joining as Host...`);
    if (btnJoin) btnJoin.disabled = true;

    try {
        // 1. Create PeerConnection
        pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        });

        // 2. Add Tracks (Sender) OR Transceivers (Observer)
        if (!isObserver) {
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

            // Quality Boost: Set maxBitrate to 2.5 Mbps (Only if sending video)
            const senders = pc.getSenders();
            const videoSender = senders.find(s => s.track && s.track.kind === 'video');
            if (videoSender) {
                const params = videoSender.getParameters();
                if (!params.encodings) params.encodings = [{}];
                params.encodings[0].maxBitrate = 2500000; // 2.5 Mbps
                await videoSender.setParameters(params);
                log('Video bit rate optimized to 2.5 Mbps');
            }
        } else {
            // Observer: Add RecvOnly Transceivers
            pc.addTransceiver('audio', { direction: 'recvonly' });
            pc.addTransceiver('video', { direction: 'recvonly' });
        }

        // 3. Handle Remote Stream
        pc.ontrack = (event) => {
            log(`Remote track received: ${event.track.kind}`);
            if (remoteVideo && remoteVideo.srcObject !== event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                log('Synchronized remote media stream');
            }
        };

        // 4. Handle ICE Candidates
        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                try {
                    await fetch('/api/candidate', {
                        method: 'POST',
                        body: JSON.stringify({
                            roomId: roomId,
                            userId: userId,
                            candidate: event.candidate.candidate,
                            sdpMid: event.candidate.sdpMid,
                            sdpMLineIndex: event.candidate.sdpMLineIndex
                        })
                    });
                } catch (e) {
                    log('ICE Candidate signaling failed', 'error');
                }
            } else {
                log('ICE gathering complete');
            }
        };

        pc.oniceconnectionstatechange = () => {
            log(`ICE connection state: ${pc.iceConnectionState}`);
        };

        // 5. Create Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        log('Generated local SDP offer');

        // 6. Send to Server via Harness
        log('Sending Offer to Server...');
        const response = await fetch('/api/join', {
            method: 'POST',
            body: JSON.stringify({
                roomId: roomId,
                userId: userId,
                sdpOffer: offer.sdp
            })
        });

        if (!response.ok) {
            throw new Error(`Server Exception: ${response.status}`);
        }

        const data = await response.json();
        log('SDP Handshake complete');

        // 7. Set Remote Description
        await pc.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: data.sdpAnswer
        }));
        log('Secure connection established');

    } catch (e) {
        log(`CRITICAL ERROR: ${e.message}`, 'error');
        if (btnJoin) btnJoin.disabled = false;
    }
}

async function negotiate() {
    if (!pc) return; // Not joined yet
    log('Spontaneously renegotiating session...');

    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const roomIdInput = document.getElementById('roomId');
        const userIdInput = document.getElementById('userId');
        if (!roomIdInput || !userIdInput) {
            log('Room ID or User ID input not found for renegotiation.', 'error');
            return;
        }

        const roomId = roomIdInput.value;
        const userId = userIdInput.value;

        const response = await fetch('/api/renegotiate', {
            method: 'POST',
            body: JSON.stringify({
                roomId: roomId,
                userId: userId,
                sdpOffer: offer.sdp
            })
        });

        if (!response.ok) {
            throw new Error(`Renegotiation failed: ${response.status}`);
        }

        const data = await response.json();
        await pc.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: data.sdpAnswer
        }));
        log('Renegotiation successful');
    } catch (e) {
        log(`Renegotiation failed: ${e.message}`, 'error');
    }
}

// Auto-Randomize ID for Test Convenience
window.onload = () => {
    const userIdInput = document.getElementById('userId');
    if (userIdInput) {
        const randomSuffix = Math.floor(Math.random() * 10000);
        // Hint at role based on page
        const prefix = window.location.pathname.includes('host') ? 'host' : 'guest';
        userIdInput.value = `user-${prefix}-${randomSuffix.toString().padStart(4, '0')}`;
    }
};
