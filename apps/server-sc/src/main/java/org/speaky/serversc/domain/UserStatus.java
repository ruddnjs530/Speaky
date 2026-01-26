package org.speaky.serversc.domain;

/**
 * 사용자 상태 Enum
 * - ACTIVE: 활성 계정
 * - BLOCKED: 정지된 계정
 * - DELETED: 삭제된 계정 (논리적 삭제)
 */
public enum UserStatus {
    ACTIVE,   // 활성 계정
    BLOCKED,  // 정지 계정
    DELETED   // 삭제 계정 (soft delete)
}
