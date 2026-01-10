package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.model.SmsLog;
import church.abunearegawi.backend.repository.MemberRepository;
import church.abunearegawi.backend.repository.SmsLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SmsService {

    private final SmsLogRepository smsLogRepository;
    private final MemberRepository memberRepository;

    @Transactional(readOnly = true)
    public Page<SmsLog> findAll(Pageable pageable) {
        return smsLogRepository.findAll(pageable);
    }

    @Transactional(readOnly = true)
    public Page<SmsLog> findBySenderId(Long senderId, Pageable pageable) {
        return smsLogRepository.findBySenderId(senderId, pageable);
    }

    @Transactional(readOnly = true)
    public Optional<SmsLog> findById(Long id) {
        return smsLogRepository.findById(id);
    }

    @Transactional
    public SmsLog logSms(SmsLog smsLog) {
        return smsLogRepository.save(smsLog);
    }

    @Transactional
    public SmsLog createSmsLog(Long senderId, String role, SmsLog.RecipientType recipientType,
                               Long recipientMemberId, Long groupId, Long departmentId,
                               Integer recipientCount, String message, SmsLog.Status status,
                               String error) {
        Member sender = memberRepository.findById(senderId)
                .orElseThrow(() -> new RuntimeException("Sender member not found"));

        SmsLog smsLog = SmsLog.builder()
                .sender(sender)
                .role(role)
                .recipientType(recipientType)
                .recipientMemberId(recipientMemberId)
                .groupId(groupId)
                .departmentId(departmentId)
                .recipientCount(recipientCount != null ? recipientCount : 1)
                .message(message)
                .status(status)
                .error(error)
                .build();

        return smsLogRepository.save(smsLog);
    }
}

