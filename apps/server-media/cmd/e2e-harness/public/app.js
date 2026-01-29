const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const logDiv = document.getElementById('logs');
const btnJoin = document.getElementById('btnJoin');

function log(msg) {
    const time = new Date().toISOString().split('T')[1];
    logDiv.innerHTML += `<div>[${time}] ${msg}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
    console.log(msg);
}

let pc;
let localStream;

async function startCamera() {
    try {
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        log('Camera acquiring success');
        btnJoin.disabled = false;

        // Late Publish Support
        if (pc && pc.connectionState !== 'closed') {
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
                // CRITICAL: Force direction update
                pc.getTransceivers().forEach(t => {
                    if (t.sender.track === track) t.direction = 'sendrecv';
                });
            });
            negotiate();
        }
    } catch (e) {
        log(`Camera Error: ${e.message}`);
    }
}

async function startScreenShare() {
    try {
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        log('Screen Share acquiring success');
        btnJoin.disabled = false;

        // Late Publish Support
        if (pc && pc.connectionState !== 'closed') {
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
                // CRITICAL: Force direction update
                pc.getTransceivers().forEach(t => {
                    if (t.sender.track === track) t.direction = 'sendrecv';
                });
            });
            negotiate();
        }
    } catch (e) {
        log(`Screen Share Error: ${e.message}`);
    }
}

async function joinRoom() {
    const roomId = document.getElementById('roomId').value;
    const userId = document.getElementById('userId').value;

    // Check for Observer Mode
    const isObserver = !localStream;
    log(isObserver ? `Joining as Observer (No Input)...` : `Joining with Media...`);
    btnJoin.disabled = true;

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
                log('Video Bitrate forced to 2.5 Mbps');
            }
        } else {
            // Observer: Add RecvOnly Transceivers
            pc.addTransceiver('audio', { direction: 'recvonly' });
            pc.addTransceiver('video', { direction: 'recvonly' });
        }

        // 3. Handle Remote Stream
        pc.ontrack = (event) => {
            log(`Remote track received: ${event.track.kind}`);
            if (remoteVideo.srcObject !== event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                log('Set remote video stream');
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
                    log('Failed to send candidate');
                }
            } else {
                log('ICE gathering complete (local)');
            }
        };

        pc.oniceconnectionstatechange = () => {
            log(`ICE State: ${pc.iceConnectionState}`);
        };

        // 5. Create Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        log('Created and set local SDP Offer');

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
            throw new Error(`Server returned ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        log('Received SDP Answer from Server');

        // 7. Set Remote Description
        await pc.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: data.sdpAnswer
        }));
        log('Set remote description. Connection establishment in progress...');

    } catch (e) {
        log(`ERROR: ${e.message}`);
        btnJoin.disabled = false;
    }
}

async function negotiate() {
    if (!pc) return; // Not joined yet
    log('Renegotiating...');

    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const roomId = document.getElementById('roomId').value;
        const userId = document.getElementById('userId').value;

        const response = await fetch('/api/renegotiate', {
            method: 'POST',
            body: JSON.stringify({
                roomId: roomId,
                userId: userId,
                sdpOffer: offer.sdp
            })
        });

        if (!response.ok) {
            throw new Error(`Renegotiate failed: ${response.status}`);
        }

        const data = await response.json();
        log(`Received Renegotiation Answer. Type: ${data.sdpAnswer ? 'Found' : 'Missing'}`);
        // Log m-lines for debugging
        if (data.sdpAnswer) {
            data.sdpAnswer.split('\r\n').forEach(l => {
                if (l.startsWith('m=') || l.startsWith('a=direction') || l.startsWith('a=send') || l.startsWith('a=recv')) log(l);
            });
        }

        await pc.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: data.sdpAnswer
        }));
        log('Renegotiation complete');
    } catch (e) {
        log(`Renegotiation Error: ${e.message}`);
    }
}
