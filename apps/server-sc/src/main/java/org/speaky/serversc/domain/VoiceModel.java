package org.speaky.serversc.domain;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "voice_models")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
@EntityListeners(AuditingEntityListener.class)
public class VoiceModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "voice_model_id")
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "storage_uri", length = 500)
    private String storageUri;

    @Column(name = "sample_uri", length = 500)
    private String sampleUri;

    @Column(name = "is_public")
    private boolean isPublic;

    // RVC Params
    @Column(name = "model_path")
    private String modelPath;

    @Column(name = "index_path")
    private String indexPath;

    @Column(name = "index_rate")
    private Double indexRate;

    @Column(name = "pitch")
    private Integer pitch;

    @Column(name = "protect")
    private Double protect;

    @Column(name = "rms_mix_rate")
    private Double rmsMixRate;

    @Column(name = "device")
    private String device;

    // 프론트 매핑용 이미지 키 (ERD엔 없지만 DTO 스펙 맞추기 위해 추가 권장, 혹은 description 활용)
    // 일단 DTO 변환 시 처리하도록 하고 여기선 스킵하거나 추가 가능.
    // ERD 준수를 위해 여기서는 ERD 필드 위주로 작성하되, imageUrl 매핑을 위해 'sample_uri'나 별도 필드 활용 고려.
    // DTO의 imageUrl은 프론트 자산 키값이므로, name 기반으로 매핑하거나 임시 로직 사용.

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
