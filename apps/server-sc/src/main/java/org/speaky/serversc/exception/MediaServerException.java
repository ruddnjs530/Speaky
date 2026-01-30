package org.speaky.serversc.exception;

import lombok.Getter;

@Getter
public class MediaServerException extends RuntimeException {
    private final String errorCode;
    private final String errorMessage;

    public MediaServerException(String errorCode, String errorMessage) {
        super(errorMessage);
        this.errorCode = errorCode;
        this.errorMessage = errorMessage;
    }

    public MediaServerException(String message) {
        super(message);
        this.errorCode = "MEDIA_SERVER_ERROR";
        this.errorMessage = message;
    }

    public MediaServerException(Throwable cause) {
        super(cause);
        this.errorCode = "MEDIA_SERVER_CONNECTION_ERROR";
        this.errorMessage = cause.getMessage();
    }
}
