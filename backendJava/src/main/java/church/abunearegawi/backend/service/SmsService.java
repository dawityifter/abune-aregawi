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
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;

@Service
@RequiredArgsConstructor
@Slf4j
public class SmsService {

    private final SmsLogRepository smsLogRepository;
    private final MemberRepository memberRepository;

    @Value("${twilio.account.sid:#{null}}")
    private String accountSid;

    @Value("${twilio.auth.token:#{null}}")
    private String authToken;

    @Value("${twilio.phone.number:#{null}}")
    private String fromNumber;

    @jakarta.annotation.PostConstruct
    public void init() {
        if (accountSid != null && authToken != null) {
            com.twilio.Twilio.init(accountSid, authToken);
            log.info("Twilio initialized successfully");
        } else {
            log.warn("Twilio credentials not found. SMS sending will be disabled.");
        }
    }

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

    public void sendSms(String to, String messageBody) {
        if (accountSid == null || authToken == null) {
            log.warn("Twilio not configured. Skipping SMS to {}", to);
            return;
        }
        try {
            com.twilio.rest.api.v2010.account.Message.creator(
                    new com.twilio.type.PhoneNumber(to),
                    new com.twilio.type.PhoneNumber(fromNumber),
                    messageBody).create();
            log.info("SMS sent to {}", to);
        } catch (Exception e) {
            log.error("Failed to send SMS to {}", to, e);
            throw e;
        }
    }

    @Transactional
    public SmsLog sendToMember(Long senderId, Long memberId, String message) {
        Member recipient = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        SmsLog.Status status = SmsLog.Status.SUCCESS;
        String error = null;

        try {
            sendSms(recipient.getPhoneNumber(), message);
        } catch (Exception e) {
            status = SmsLog.Status.FAILED;
            error = e.getMessage();
        }

        return createSmsLog(senderId, "UNKNOWN", SmsLog.RecipientType.INDIVIDUAL,
                memberId, null, null, 1, message, status, error);
    }

    private final church.abunearegawi.backend.repository.MemberGroupRepository memberGroupRepository;
    private final church.abunearegawi.backend.repository.DepartmentMemberRepository departmentMemberRepository;

    @Transactional
    public SmsLog sendToGroup(Long senderId, Long groupId, String message) {
        java.util.List<church.abunearegawi.backend.model.MemberGroup> memberGroups = memberGroupRepository
                .findByGroupId(groupId);
        java.util.List<Member> recipients = memberGroups.stream()
                .map(church.abunearegawi.backend.model.MemberGroup::getMember)
                .filter(Member::isActive)
                .collect(java.util.stream.Collectors.toList());

        return bulkSend(senderId, recipients, SmsLog.RecipientType.GROUP, groupId, null, message);
    }

    @Transactional
    public SmsLog sendToDepartment(Long senderId, Long departmentId, String message) {
        java.util.List<church.abunearegawi.backend.model.DepartmentMember> deptMembers = departmentMemberRepository
                .findByDepartmentIdAndStatus(departmentId,
                        church.abunearegawi.backend.model.DepartmentMember.Status.active);
        java.util.List<Member> recipients = deptMembers.stream()
                .map(church.abunearegawi.backend.model.DepartmentMember::getMember)
                .filter(Member::isActive)
                .collect(java.util.stream.Collectors.toList());

        return bulkSend(senderId, recipients, SmsLog.RecipientType.DEPARTMENT, null, departmentId, message);
    }

    @Transactional
    public SmsLog sendToAll(Long senderId, String message) {
        java.util.List<Member> recipients = memberRepository.findByIsActiveTrue();
        return bulkSend(senderId, recipients, SmsLog.RecipientType.ALL, null, null, message);
    }

    @Transactional
    public java.util.List<church.abunearegawi.backend.dto.MemberDTO> getGroupRecipients(Long groupId) {
        return memberGroupRepository.findByGroupId(groupId).stream()
                .map(church.abunearegawi.backend.model.MemberGroup::getMember)
                .filter(Member::isActive)
                .map(church.abunearegawi.backend.dto.MemberDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
    }

    @Transactional
    public java.util.List<church.abunearegawi.backend.dto.MemberDTO> getDepartmentRecipients(Long departmentId) {
        return departmentMemberRepository
                .findByDepartmentIdAndStatus(departmentId,
                        church.abunearegawi.backend.model.DepartmentMember.Status.active)
                .stream()
                .map(church.abunearegawi.backend.model.DepartmentMember::getMember)
                .filter(Member::isActive)
                .map(church.abunearegawi.backend.dto.MemberDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
    }

    private final church.abunearegawi.backend.repository.PledgeRepository pledgeRepository;

    @Transactional
    public SmsLog sendToPendingPledges(Long senderId, String message) {
        java.util.List<church.abunearegawi.backend.model.Pledge> pledges = pledgeRepository
                .findByStatus(church.abunearegawi.backend.model.Pledge.Status.pending);
        return sendToPledgeList(senderId, pledges, message);
    }

    @Transactional
    public SmsLog sendToFulfilledPledges(Long senderId, String message) {
        java.util.List<church.abunearegawi.backend.model.Pledge> pledges = pledgeRepository
                .findByStatus(church.abunearegawi.backend.model.Pledge.Status.fulfilled);
        return sendToPledgeList(senderId, pledges, message);
    }

    private SmsLog sendToPledgeList(Long senderId, java.util.List<church.abunearegawi.backend.model.Pledge> pledges,
            String message) {
        java.util.List<Member> recipients = pledges.stream()
                .map(church.abunearegawi.backend.model.Pledge::getMember)
                .filter(m -> m != null && m.isActive())
                .distinct()
                .collect(java.util.stream.Collectors.toList());

        return bulkSend(senderId, recipients, SmsLog.RecipientType.ALL, null, null, message);
    }

    @Transactional
    public java.util.List<church.abunearegawi.backend.dto.MemberDTO> getPendingPledgesRecipients() {
        return pledgeRepository.findByStatus(church.abunearegawi.backend.model.Pledge.Status.pending).stream()
                .map(church.abunearegawi.backend.model.Pledge::getMember)
                .filter(m -> m != null && m.isActive())
                .distinct()
                .map(church.abunearegawi.backend.dto.MemberDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
    }

    @Transactional
    public java.util.List<church.abunearegawi.backend.dto.MemberDTO> getFulfilledPledgesRecipients() {
        return pledgeRepository.findByStatus(church.abunearegawi.backend.model.Pledge.Status.fulfilled).stream()
                .map(church.abunearegawi.backend.model.Pledge::getMember)
                .filter(m -> m != null && m.isActive())
                .distinct()
                .map(church.abunearegawi.backend.dto.MemberDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
    }

    @Transactional
    public java.util.List<church.abunearegawi.backend.dto.MemberDTO> getAllRecipients() {
        return memberRepository.findByIsActiveTrue().stream()
                .map(church.abunearegawi.backend.dto.MemberDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
    }

    private SmsLog bulkSend(Long senderId, java.util.List<Member> recipients, SmsLog.RecipientType type, Long groupId,
            Long departmentId, String message) {
        int successful = 0;
        int failed = 0;
        StringBuilder errors = new StringBuilder();

        for (Member m : recipients) {
            try {
                if (m.getPhoneNumber() != null && !m.getPhoneNumber().isEmpty()) {
                    sendSms(m.getPhoneNumber(), message);
                    successful++;
                } else {
                    failed++;
                }
            } catch (Exception e) {
                failed++;
                errors.append("Failed for ").append(m.getId()).append(": ").append(e.getMessage()).append("; ");
            }
        }

        SmsLog.Status status = (failed == 0) ? SmsLog.Status.SUCCESS
                : (successful > 0 ? SmsLog.Status.PARTIAL : SmsLog.Status.FAILED);
        String errorMsg = errors.length() > 0 ? errors.toString() : null;

        return createSmsLog(senderId, "UNKNOWN", type, null, groupId, departmentId, recipients.size(), message, status,
                errorMsg);
    }
}
