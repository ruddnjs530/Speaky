package org.speaky.serversc.exception;

import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import lombok.Getter;

/**
 * Media Server 통신 중 발생하는 예외
 * 
 * gRPC StatusRuntimeException의 상세 정보를 포함하여
 * 디버깅 및 문제 해결을 용이하게 합니다.
 */
@Getter
public class MediaServerException extends RuntimeException {
    
    private final String errorCode;
    private final String errorMessage;
    private final Status.Code grpcCode;  // gRPC 상태 코드 (UNAVAILABLE, DEADLINE_EXCEEDED 등)
    
    /**
     * 에러 코드와 메시지를 지정한 예외 생성
     */
    public MediaServerException(String errorCode, String errorMessage) {
        super(errorMessage);
        this.errorCode = errorCode;
        this.errorMessage = errorMessage;
        this.grpcCode = null;
    }
    
    /**
     * 일반 메시지만으로 예외 생성
     */
    public MediaServerException(String message) {
        super(message);
        this.errorCode = "MEDIA_SERVER_ERROR";
        this.errorMessage = message;
        this.grpcCode = null;
    }
    
    /**
     * gRPC StatusRuntimeException으로부터 예외 생성
     * 
     * gRPC의 상세한 에러 정보를 추출하여 저장합니다.
     */
    public MediaServerException(StatusRuntimeException cause) {
        super(cause);
        Status status = cause.getStatus();
        this.grpcCode = status.getCode();
        this.errorCode = status.getCode().name();
        this.errorMessage = status.getDescription() != null 
                ? status.getDescription() 
                : status.getCode().toString();
    }
    
    /**
     * 일반 Throwable로부터 예외 생성
     */
    public MediaServerException(Throwable cause) {
        super(cause);
        this.errorCode = "MEDIA_SERVER_CONNECTION_ERROR";
        this.errorMessage = cause.getMessage();
        this.grpcCode = null;
    }
    
    @Override
    public String toString() {
        if (grpcCode != null) {
            return String.format("MediaServerException[code=%s, grpcCode=%s, message=%s]", 
                    errorCode, grpcCode, errorMessage);
        }
        return String.format("MediaServerException[code=%s, message=%s]", 
                errorCode, errorMessage);
    }
}
