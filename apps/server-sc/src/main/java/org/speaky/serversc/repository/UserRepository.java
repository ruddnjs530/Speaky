package org.speaky.serversc.repository;

import org.speaky.serversc.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * User Repository
 * Spring Data JPA 기반 사용자 조회/저장
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    
    /**
     * loginId로 사용자 조회
     * 로그인 시 사용
     */
    Optional<User> findByLoginId(String loginId);
    
    /**
     * loginId 중복 확인
     * 회원가입 시 사용
     */
    boolean existsByLoginId(String loginId);
}
