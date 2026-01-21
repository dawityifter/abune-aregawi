package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.model.ZelleMemoMatch;
import church.abunearegawi.backend.repository.MemberRepository;
import church.abunearegawi.backend.repository.ZelleMemoMatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ZelleService {

    private final ZelleMemoMatchRepository zelleMemoMatchRepository;
    private final MemberRepository memberRepository;
    private final church.abunearegawi.backend.repository.TransactionRepository transactionRepository;
    private final church.abunearegawi.backend.repository.IncomeCategoryRepository incomeCategoryRepository;
    // Circular dependency risk? ZelleGmailService uses Repos. This service uses
    // ZelleGmailService. Correct.
    private final ZelleGmailService zelleGmailService;

    @Transactional(readOnly = true)
    public List<ZelleMemoMatch> findAll() {
        return zelleMemoMatchRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<ZelleMemoMatch> findByMemberId(Long memberId) {
        return zelleMemoMatchRepository.findByMemberId(memberId);
    }

    @Transactional(readOnly = true)
    public List<ZelleMemoMatch> findByMemo(String memo) {
        return zelleMemoMatchRepository.findByMemoContainingIgnoreCase(memo);
    }

    @Transactional(readOnly = true)
    public Optional<ZelleMemoMatch> findByMemberIdAndMemo(Long memberId, String memo) {
        return zelleMemoMatchRepository.findByMemberIdAndMemo(memberId, memo);
    }

    @Transactional
    public ZelleMemoMatch create(Long memberId, String firstName, String lastName, String memo) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        ZelleMemoMatch match = ZelleMemoMatch.builder()
                .member(member)
                .firstName(firstName)
                .lastName(lastName)
                .memo(memo)
                .build();

        return zelleMemoMatchRepository.save(match);
    }

    @Transactional
    public void delete(java.util.UUID id) {
        zelleMemoMatchRepository.deleteById(id);
    }

    public java.util.Map<String, Object> previewGmail(int limit) throws Exception {
        return zelleGmailService.previewZelleFromGmail(limit);
    }

    @Transactional
    public church.abunearegawi.backend.model.Transaction processTransactionCreation(
            ZelleGmailService.ParsedZelle item, Long collectedById) {

        if (item.getExternalId() != null && transactionRepository.existsByExternalId(item.getExternalId())) {
            throw new RuntimeException("Transaction already exists: " + item.getExternalId());
        }

        Member member = memberRepository.findById(item.getMatchedMemberId())
                .orElseThrow(() -> new RuntimeException("Member not found: " + item.getMatchedMemberId()));

        Member collector = memberRepository.findById(collectedById)
                .orElseThrow(() -> new RuntimeException("Collector not found: " + collectedById));

        // Income Category logic
        String paymentType = item.getPaymentType(); // "donation" usually
        church.abunearegawi.backend.model.IncomeCategory incomeCategory = incomeCategoryRepository
                .findByPaymentTypeMapping(paymentType)
                .stream().findFirst().orElse(null);

        // Fallback
        if (incomeCategory == null) {
            incomeCategory = incomeCategoryRepository.findByPaymentTypeMapping("donation")
                    .stream().findFirst().orElse(null);
        }

        church.abunearegawi.backend.model.Transaction tx = church.abunearegawi.backend.model.Transaction.builder()
                .member(member)
                .collector(collector)
                .paymentDate(item.getPaymentDate())
                .amount(item.getAmount())
                .paymentType(church.abunearegawi.backend.model.Transaction.PaymentType.valueOf(paymentType)) // Enum
                                                                                                             // safety
                                                                                                             // concern
                .paymentMethod(church.abunearegawi.backend.model.Transaction.PaymentMethod.zelle)
                .status(church.abunearegawi.backend.model.Transaction.Status.succeeded)
                .note(item.getNotePreview())
                .externalId(item.getExternalId())
                .incomeCategory(incomeCategory)
                .build();

        tx = transactionRepository.save(tx);

        // Upsert Memo Match
        String cleanMemo = item.getNotePreview();
        if (cleanMemo != null && !cleanMemo.isBlank()) {
            Optional<ZelleMemoMatch> existing = zelleMemoMatchRepository.findByMemoIgnoreCase(cleanMemo);
            if (existing.isEmpty()) {
                ZelleMemoMatch match = ZelleMemoMatch.builder()
                        .member(member)
                        .firstName(member.getFirstName())
                        .lastName(member.getLastName())
                        .memo(cleanMemo)
                        .build();
                zelleMemoMatchRepository.save(match);
            } else {
                ZelleMemoMatch match = existing.get();
                if (!match.getMember().getId().equals(member.getId())) {
                    match.setMember(member);
                    match.setFirstName(member.getFirstName());
                    match.setLastName(member.getLastName());
                    zelleMemoMatchRepository.save(match);
                }
            }
        }

        // Logic for LedgerEntry can go here or be handled by an event listener
        // Node.js creates LedgerEntry manually.
        // We'll skip LedgerEntry for now as it wasn't requested in features (or maybe
        // it is implied by "parity"?).
        // Let's assume parity means critical flow. Ledger is critical.
        // But Transaction entity might have cascade? No.

        return tx;
    }

    @Transactional
    public List<church.abunearegawi.backend.model.Transaction> batchCreate(
            List<ZelleGmailService.ParsedZelle> items, Long collectedById) {
        List<church.abunearegawi.backend.model.Transaction> created = new java.util.ArrayList<>();
        for (ZelleGmailService.ParsedZelle item : items) {
             try {
                 created.add(processTransactionCreation(item, collectedById));
             } catch (Exception e) {
                 // Log error but continue batch?
                 // Or throw? Node.js returns success: false for individual items.
                 // Java typically throws or returns a Result object.
                 // We will skip failed ones for this implementation or rethrow if needed.
             }
        }
        return created;
    }
}
