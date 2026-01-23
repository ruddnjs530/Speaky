import type { Envelope } from '../../../shared/lib/signaling/envelope';
import type { SendOpts } from '../../../shared/lib/signaling/SignalingClient';
import { SignalingClient } from '../../../shared/lib/signaling/SignalingClient';

type SigOfferPayload = { sdpType: 'offer'; sdp: string };
type SigAnswerPayload = { sdpType: 'answer'; sdp: string };
type SigIcePayload = {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
};

type HostPeerControllerArgs = {
  signaling: SignalingClient;
  sendOpts: SendOpts; // { channelId, sessionId, from:{role:'HOST', ...} }
  rtcConfig: RTCConfiguration;
  getLocalStream: () => MediaStream | null;

  onPcState?: (s: RTCPeerConnectionState) => void;
};

export class HostPeerController {
  private readonly args: HostPeerControllerArgs;

  constructor(args: HostPeerControllerArgs) {
    this.args = args;
  }
  private pc: RTCPeerConnection | null = null;
  private remoteDescSet = false;
  private pendingRemoteIce: RTCIceCandidateInit[] = [];

  private gen = 0; // 재생성 레이스 가드


  async start() {
    await this.recreatePcAndRestartOffer();
  }

  stop() {
    this.closePc();
  }

  // useHostPeerConnection의 onMessage에서 넘겨받은 Envelope 처리
  async handleEnvelope(env: Envelope) {
    const pc = this.pc;
    if (!pc) return;

    if (env.type === 'SIG_ANSWER') {
      const p = env.payload as SigAnswerPayload | undefined;
      if (!p?.sdp) return;

      const localGen = this.gen;
      try {
        await pc.setRemoteDescription({ type: p.sdpType, sdp: p.sdp });
        this.remoteDescSet = true;
        await this.flushPendingRemoteIce(localGen);
      } catch {
        // 정책 고정: 실패하면 PC 재생성 후 offer부터 재시작
        await this.recreatePcAndRestartOffer();
      }
      return;
    }

    if (env.type === 'SIG_ICE') {
      const p = env.payload as SigIcePayload | undefined;
      if (!p?.candidate) return;

      const ice: RTCIceCandidateInit = {
        candidate: p.candidate,
        sdpMid: p.sdpMid ?? undefined,
        sdpMLineIndex: p.sdpMLineIndex ?? undefined,
      };

      if (!this.remoteDescSet || !pc.remoteDescription) {
        this.pendingRemoteIce.push(ice);
        return;
      }

      try {
        await pc.addIceCandidate(ice);
      } catch {
        // ignore
      }
    }
  }

  // ---------------- internal ----------------

  private async recreatePcAndRestartOffer() {
    this.gen += 1;
    this.remoteDescSet = false;
    this.pendingRemoteIce = [];

    this.closePc();
    this.pc = this.createPc();

    await this.restartOffer();
  }

  private createPc() {
    const pc = new RTCPeerConnection(this.args.rtcConfig);

    // 로컬 트랙 추가
    const stream = this.args.getLocalStream();
    if (stream) {
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }
    }

    // ICE -> SIG_ICE
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;

      this.args.signaling.sendMessage<SigIcePayload>(
        'SIG_ICE',
        this.args.sendOpts,
        {
          candidate: ev.candidate.candidate,
          sdpMid: ev.candidate.sdpMid,
          sdpMLineIndex: ev.candidate.sdpMLineIndex,
        }
      );
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      this.args.onPcState?.(s);

      // 정책 고정: 끊기면 PC 재생성, offer부터
      if (s === 'failed' || s === 'disconnected') {
        void this.recreatePcAndRestartOffer();
      }
    };

    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      if (s === 'failed' || s === 'disconnected') {
        void this.recreatePcAndRestartOffer();
      }
    };

    return pc;
  }

  private async restartOffer() {
    const pc = this.pc;
    if (!pc) return;

    const localGen = this.gen;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // SIG_OFFER
      this.args.signaling.sendMessage<SigOfferPayload>(
        'SIG_OFFER',
        this.args.sendOpts,
        {
          sdpType: 'offer',
          sdp: pc.localDescription?.sdp ?? '',
        }
      );

      // 재생성 레이스 가드
      if (localGen !== this.gen) return;
    } catch {
      await this.recreatePcAndRestartOffer();
    }
  }

  private async flushPendingRemoteIce(localGen: number) {
    const pc = this.pc;
    if (!pc) return;
    if (localGen !== this.gen) return;

    const list = this.pendingRemoteIce;
    this.pendingRemoteIce = [];

    for (const c of list) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        // ignore
      }
    }
  }

  private closePc() {
    const pc = this.pc;
    if (!pc) return;

    this.pc = null;
    try {
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
    } catch {
      // ignore
    }
  }
}
