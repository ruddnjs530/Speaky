package core

import (
    "context"
    "errors"
    "io"
    "log/slog"
    "sync"
    "time"

    "speaky-media/internal/config"
    "speaky-media/internal/pipeline"
    "speaky-media/internal/transcode"
    "speaky-media/internal/upstream"

    pb "mediaserver/proto"

    "github.com/pion/rtp"
)

// AudioProcessor manages the transcoding and AI processing lifecycle for a single track.
type AudioProcessor struct {
    decoder    *transcode.OpusDecoder
    encoder    *transcode.OpusEncoder
    packetizer *transcode.RTPPacketizer
    aiClient   upstream.VoiceProcessor
    outQueue   *pipeline.Queue[pipeline.RTPPacket]

    // Ingest Buffering
    pcmBuffer     []int16        // Accumulates PCM samples
    bufferLimit   int            // Threshold to send to AI
    firstPacketTS uint32         // RTP Timestamp of the first packet in the buffer (for tracking)
    tsMap         map[uint32]time.Time // Key: RTP Timestamp (start of chunk), Value: ArrivalTime
    tsMutex       sync.Mutex
	egressRemainder []int16

	// Config
	cfg *config.Config
}

// NewAudioProcessor creates a new AudioProcessor.
func NewAudioProcessor(cfg *config.Config, aiClient upstream.VoiceProcessor, outQueue *pipeline.Queue[pipeline.RTPPacket]) (*AudioProcessor, error) {
    decoder, err := transcode.NewOpusDecoder(cfg.AudioSampleRate, 1)
    if err != nil {
        return nil, err
    }

    encoder, err := transcode.NewOpusEncoder(cfg.AudioSampleRate, 1)
    if err != nil {
        return nil, err
    }

    packetizer := transcode.NewRTPPacketizer(12345, 111, 1200)

	// Calculate buffer limit (samples) based on duration (ms)
	// samples = Rate * Duration / 1000
    // Default fallback to 400ms if 0
    bufferMs := cfg.AIBufferDuration
    if bufferMs <= 0 {
        bufferMs = 400
    }
    bufferLimit := cfg.AudioSampleRate * bufferMs / 1000

    return &AudioProcessor{
        decoder:     decoder,
        encoder:     encoder,
        packetizer:  packetizer,
        aiClient:    aiClient,
        outQueue:    outQueue,
        pcmBuffer:   make([]int16, 0, bufferLimit), 
        bufferLimit: bufferLimit,                   
        tsMap:       make(map[uint32]time.Time),
		cfg:         cfg,
    }, nil
}

// Start begins the processing loop.
func (p *AudioProcessor) Start(ctx context.Context, input <-chan pipeline.RTPPacket) error {
    stream, err := p.aiClient.NewStream(ctx)
    if err != nil {
        return err
    }
    defer stream.Close()

    errChan := make(chan error, 1)
    go p.readLoop(ctx, stream, errChan)

    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case err := <-errChan:
            return err
        case pkt, ok := <-input:
            if !ok {
                return nil
            }
            if err := p.processInputPacket(stream, pkt); err != nil {
                slog.Error("Failed to process input packet", "error", err)
            }
        }
    }
}

// processInputPacket decodes RTP and buffers PCM until threshold is met
func (p *AudioProcessor) processInputPacket(stream upstream.VoiceStream, pipePkt pipeline.RTPPacket) error {
    // 0. Unmarshal RTP Packet
    pkt := &rtp.Packet{}
    if err := pkt.Unmarshal(pipePkt.Data); err != nil {
        return err
    }

    // 1. Decode Opus -> PCM
    pcm, err := p.decoder.Decode(pkt.Payload)
    if err != nil {
        return err
    }

    // 2. Capture Timing (Only for the first packet in the chunk)
    if len(p.pcmBuffer) == 0 {
        p.firstPacketTS = pkt.Timestamp
        p.tsMutex.Lock()
        p.tsMap[pkt.Timestamp] = pipePkt.ArrivalTime
        p.tsMutex.Unlock()
    }

    // 3. Buffer PCM
    p.pcmBuffer = append(p.pcmBuffer, pcm...)

    // 4. Check Threshold (Buffering Logic) [Image of Audio Buffering Logic]
    if len(p.pcmBuffer) >= p.bufferLimit {
        // Convert to Bytes (Little Endian)
        pcmBytes := Int16ToBytes(p.pcmBuffer)

        // Send to AI Server
        chunk := &pb.AudioChunk{
            Pcm:          pcmBytes,
            SampleRate:   int32(p.cfg.AudioSampleRate), 
            Channels:     1,
            Timestamp:    p.firstPacketTS, // Use the TS of the start of this chunk
            VoiceModelId: 1, // Use String ID as per your AI Log
        }
        
        // Reset Buffer
        p.pcmBuffer = p.pcmBuffer[:0] // Keep capacity, reset length

        return stream.Send(chunk)
    }

    return nil
}

// readLoop reads processed PCM from AI stream, encodes, and pushes to queue
func (p *AudioProcessor) readLoop(ctx context.Context, stream upstream.VoiceStream, errChan chan<- error) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		// 1. AI 서버로부터 처리된 PCM 수신 (덩어리 단위)
		chunk, err := stream.Recv()
		if err != nil {
			if errors.Is(err, io.EOF) {
				return
			}
			slog.Error("AP: AI Stream Recv Error", "error", err)
			errChan <- err
			return
		}

		// 2. 바이트 데이터를 int16 슬라이스로 변환
		pcm, err := BytesToInt16(chunk.Pcm)
		if err != nil {
			slog.Error("Failed to convert received PCM bytes", "error", err)
			continue
		}

		// [중요] 이전 루프에서 남은 자투리 데이터와 현재 받은 데이터를 합침
		fullPCM := make([]int16, len(p.egressRemainder)+len(pcm))
		copy(fullPCM, p.egressRemainder)
		copy(fullPCM[len(p.egressRemainder):], pcm)
		
		// 사용한 자투리는 비워줌
		p.egressRemainder = p.egressRemainder[:0] 

		// Calculate frame size dynamically (e.g. 960 for 20ms @ 48kHz)
        // Ensure AudioFrameDuration is valid (default 20ms)
        frameDuration := p.cfg.AudioFrameDuration
        if frameDuration <= 0 {
            frameDuration = 20
        }
        frameSize := p.cfg.AudioSampleRate * frameDuration / 1000

		// 해당 덩어리의 원본 도착 시간(ArrivalTime) 조회
		p.tsMutex.Lock()
		chunkArrivalTime, ok := p.tsMap[chunk.Timestamp]
		if !ok {
			chunkArrivalTime = time.Now()
		} else {
			// 사용한 맵 데이터 삭제
			delete(p.tsMap, chunk.Timestamp)
		}
		p.tsMutex.Unlock()

		// 3. 합쳐진 데이터를 20ms(960 샘플) 단위로 잘라서 처리
		i := 0
		for ; i+frameSize <= len(fullPCM); i += frameSize {
			framePCM := fullPCM[i : i+frameSize]

			// PCM -> Opus 인코딩
			encoded, err := p.encoder.Encode(framePCM)
			if err != nil {
				slog.Error("Failed to encode processed audio", "error", err)
				continue
			}

			// Opus -> RTP 패킷화
			packets, err := p.packetizer.Packetize([][]byte{encoded})
			if err != nil {
				slog.Error("Failed to packetize encoded audio", "error", err)
				continue
			}

			// 4. 생성된 RTP 패킷들을 큐에 푸시
			for _, rtpPkt := range packets {
				// 원본 Timestamp를 기준으로 오프셋을 계산해 정확한 RTP Timestamp 부여
				rtpPkt.Timestamp = chunk.Timestamp + uint32(i)

				// 20ms 단위로 ArrivalTime에 오프셋을 더해 시간을 보간(Interpolation)
				// 이렇게 해야 VideoBuffer에서 비디오가 뭉텅이로 풀리지 않고 부드럽게 재생됨
				frameOffset := time.Duration(i/frameSize*frameDuration) * time.Millisecond
				packetArrivalTime := chunkArrivalTime.Add(frameOffset)

				raw, err := rtpPkt.Marshal()
				if err != nil {
					continue
				}

				if err := p.outQueue.Push(pipeline.RTPPacket{
					Data:        raw,
					ArrivalTime: packetArrivalTime,
				}); err != nil {
					slog.Warn("AP: OutQueue Push Failed", "error", err)
				}
			}
		}

		// [중요] 20ms로 나누어 떨어지지 않고 남은 데이터는 다음 루프를 위해 저장
		if i < len(fullPCM) {
			remainder := fullPCM[i:]
			p.egressRemainder = make([]int16, len(remainder))
			copy(p.egressRemainder, remainder)
		}
	}
}