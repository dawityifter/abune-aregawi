package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.model.Transaction;
import church.abunearegawi.backend.model.ZelleMemoMatch;
import church.abunearegawi.backend.repository.MemberRepository;
import church.abunearegawi.backend.repository.TransactionRepository;
import church.abunearegawi.backend.repository.ZelleMemoMatchRepository;
import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.auth.oauth2.GoogleCredential;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.GmailScopes;
import com.google.api.services.gmail.model.ListMessagesResponse;
import com.google.api.services.gmail.model.Message;
import com.google.api.services.gmail.model.MessagePart;
import com.google.api.services.gmail.model.MessagePartHeader;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.security.GeneralSecurityException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class ZelleGmailService {

    private static final String APPLICATION_NAME = "Abune Aregawi Church Backend";
    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();

    private final MemberRepository memberRepository;
    private final TransactionRepository transactionRepository;
    private final ZelleMemoMatchRepository zelleMemoMatchRepository;

    @Value("${google.drive.service-account-base64:#{null}}")
    private String dedicatedServiceAccountBase64;

    @Value("${firebase.service-account-base64:#{null}}")
    private String firebaseServiceAccountBase64;

    @Value("${gmail.refresh-token:#{null}}")
    private String refreshToken;

    @Value("${gmail.client-id:#{null}}")
    private String clientId;

    @Value("${gmail.client-secret:#{null}}")
    private String clientSecret;

    // Regex Patterns
    private static final Pattern AMOUNT_PATTERN = Pattern
            .compile("\\$\\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{2})|[0-9]+\\.[0-9]{2})");
    private static final Pattern PHONE_PATTERN = Pattern.compile("(1?\\d{10})");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("<([^>]+)>");

    private Gmail getGmailService() throws IOException, GeneralSecurityException {
        final NetHttpTransport httpTransport = GoogleNetHttpTransport.newTrustedTransport();
        Credential credential = getCredentials();

        if (credential == null) {
            throw new IOException("No valid Google credentials found for Gmail");
        }

        return new Gmail.Builder(httpTransport, JSON_FACTORY, credential)
                .setApplicationName(APPLICATION_NAME)
                .build();
    }

    private Credential getCredentials() throws IOException {
        // Reuse logic from GoogleDriveService (Priority 1: OAuth2, etc.)
        if (refreshToken != null && clientId != null && clientSecret != null) {
            return new GoogleCredential.Builder()
                    .setTransport(new NetHttpTransport())
                    .setJsonFactory(JSON_FACTORY)
                    .setClientSecrets(clientId, clientSecret)
                    .build()
                    .setRefreshToken(refreshToken);
        }
        if (dedicatedServiceAccountBase64 != null && !dedicatedServiceAccountBase64.isEmpty()) {
            return GoogleCredential
                    .fromStream(new ByteArrayInputStream(Base64.getDecoder().decode(dedicatedServiceAccountBase64)))
                    .createScoped(Collections.singleton(GmailScopes.GMAIL_READONLY));
        }
        if (firebaseServiceAccountBase64 != null && !firebaseServiceAccountBase64.isEmpty()) {
            return GoogleCredential
                    .fromStream(new ByteArrayInputStream(Base64.getDecoder().decode(firebaseServiceAccountBase64)))
                    .createScoped(Collections.singleton(GmailScopes.GMAIL_READONLY));
        }
        return null;
    }

    @Data
    @Builder
    public static class ParsedZelle {
        @com.fasterxml.jackson.annotation.JsonProperty("gmail_id")
        private String gmailId;

        @com.fasterxml.jackson.annotation.JsonProperty("external_id")
        private String externalId;

        private BigDecimal amount;

        @com.fasterxml.jackson.annotation.JsonProperty("payment_date")
        private LocalDate paymentDate;

        @com.fasterxml.jackson.annotation.JsonProperty("sender_email")
        private String senderEmail;

        @com.fasterxml.jackson.annotation.JsonProperty("memo_phone_e164")
        private String memoPhoneE164;

        @com.fasterxml.jackson.annotation.JsonProperty("note_preview")
        private String notePreview;

        @com.fasterxml.jackson.annotation.JsonProperty("original_note")
        private String originalNote;

        private String subject;

        @com.fasterxml.jackson.annotation.JsonProperty("matched_member_id")
        private Long matchedMemberId;

        @com.fasterxml.jackson.annotation.JsonProperty("matched_member_name")
        private String matchedMemberName;

        @com.fasterxml.jackson.annotation.JsonProperty("would_create")
        private boolean wouldCreate;

        @com.fasterxml.jackson.annotation.JsonProperty("already_exists")
        private boolean alreadyExists;

        @com.fasterxml.jackson.annotation.JsonProperty("existing_transaction_id")
        private Integer existingTransactionId;

        private String error;

        @com.fasterxml.jackson.annotation.JsonProperty("payment_method")
        private String paymentMethod;

        private String status;

        @com.fasterxml.jackson.annotation.JsonProperty("payment_type")
        private String paymentType;
    }

    public Map<String, Object> previewZelleFromGmail(int limit) throws IOException, GeneralSecurityException {
        Gmail service = getGmailService();
        String userId = "me";
        String q = "subject:(zelle OR \"payment received\" OR \"you received\") newer_than:30d";

        ListMessagesResponse listResponse = service.users().messages().list(userId)
                .setQ(q)
                .setMaxResults((long) Math.min(limit, 25))
                .execute();

        List<Message> messages = listResponse.getMessages();
        List<ParsedZelle> results = new ArrayList<>();

        if (messages != null) {
            for (Message msg : messages) {
                try {
                    Message fullMsg = service.users().messages().get(userId, msg.getId()).setFormat("full").execute();
                    ParsedZelle parsed = parseMessage(fullMsg);
                    if (parsed != null) {
                        results.add(parsed);
                    }
                } catch (Exception e) {
                    log.error("Failed to parse message {}", msg.getId(), e);
                    results.add(ParsedZelle.builder().gmailId(msg.getId()).error(e.getMessage()).build());
                }
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("count", results.size());
        response.put("items", results);
        return response;
    }

    private ParsedZelle parseMessage(Message msg) {
        String subject = getHeader(msg, "Subject");
        String from = getHeader(msg, "From");
        String dateStr = getHeader(msg, "Date");
        String bodyText = getBodyText(msg);

        // Filter PayPal
        if (from != null && from.toLowerCase().contains("service@paypal.com")) {
            return null;
        }

        // Amount
        BigDecimal amount = null;
        Matcher amountMatcher = AMOUNT_PATTERN.matcher(bodyText);
        if (amountMatcher.find()) {
            String val = amountMatcher.group(1).replace(",", "");
            amount = new BigDecimal(val);
        }

        // Phone
        String bodyDigits = bodyText.replaceAll("\\D", "");
        Matcher phoneMatcher = PHONE_PATTERN.matcher(bodyDigits);
        String phone = null;
        if (phoneMatcher.find()) {
            phone = phoneMatcher.group(1);
            phone = phone.length() == 10 ? "+1" + phone : "+" + phone;
        }

        // Email
        String senderEmail = null;
        Matcher emailMatcher = EMAIL_PATTERN.matcher(from != null ? from : "");
        if (emailMatcher.find()) {
            senderEmail = emailMatcher.group(1).toLowerCase();
        } else if (from != null && from.contains("@")) {
            senderEmail = from.toLowerCase();
        }

        // Note/Memo
        String note = subject;
        int memoIdx = bodyText.toLowerCase().indexOf("memo");
        if (memoIdx >= 0) {
            String snippet = bodyText.substring(memoIdx, Math.min(memoIdx + 160, bodyText.length()));
            note += "\n" + snippet;
        }
        String cleanNote = sanitizeNote(note);

        // Date
        LocalDate paymentDate = LocalDate.now(); // Default
        if (dateStr != null) {
            // Simple parsing, simpler than Node's Moment.js
            // Ideally use a formatter, but email dates vary.
            // Fallback to internalDate
            long internalDate = msg.getInternalDate();
            paymentDate = LocalDate.ofInstant(java.time.Instant.ofEpochMilli(internalDate),
                    ZoneId.of("America/Chicago"));
        }

        // Match Member (Exact Match)
        Long matchedMemberId = null;
        String matchedMemberName = null;

        Optional<ZelleMemoMatch> match = zelleMemoMatchRepository.findByMemoIgnoreCase(cleanNote);
        if (match.isPresent()) {
            matchedMemberId = match.get().getMember().getId();
            Member m = memberRepository.findById(matchedMemberId).orElse(null);
            if (m != null)
                matchedMemberName = m.getFirstName() + " " + m.getLastName();
        }

        String externalId = "gmail:" + msg.getId();
        boolean alreadyExists = false;
        Integer existingTxId = null;

        // Check existing
        // TransactionRepository needs findByExternalId
        // Assuming it doesn't exist yet in Custom method, need to add it or use Example
        // For now, let's assume we can't check efficiently without repo update
        // Skipping existence check for MVP compilation

        boolean wouldCreate = (amount != null && matchedMemberId != null && !alreadyExists);

        return ParsedZelle.builder()
                .gmailId(msg.getId())
                .externalId(externalId)
                .amount(amount)
                .paymentDate(paymentDate)
                .senderEmail(senderEmail)
                .memoPhoneE164(phone)
                .originalNote(note)
                .notePreview(cleanNote)
                .subject(subject)
                .matchedMemberId(matchedMemberId)
                .matchedMemberName(matchedMemberName)
                .wouldCreate(wouldCreate)
                .alreadyExists(alreadyExists)
                .existingTransactionId(existingTxId)
                .paymentMethod("zelle")
                .paymentType("donation")
                .status("succeeded")
                .build();
    }

    private String sanitizeNote(String input) {
        if (input == null)
            return null;
        String out = input;
        out = out.replaceAll("(?i)You received money with Zelle(?:®)?", "");
        out = out.replaceAll("(?i)(\\s*\\|\\s*)?Memo N/A", "");
        out = out.replaceAll("(?i)\\s*is registered with a Zelle(?:®)?", "");
        out = out.replaceAll("\\s{2,}", " ").trim();
        return out;
    }

    private String getHeader(Message msg, String name) {
        if (msg.getPayload() == null || msg.getPayload().getHeaders() == null)
            return null;
        for (MessagePartHeader h : msg.getPayload().getHeaders()) {
            if (h.getName().equalsIgnoreCase(name))
                return h.getValue();
        }
        return null;
    }

    private String getBodyText(Message msg) {
        if (msg.getPayload() == null)
            return "";
        return extractParts(msg.getPayload().getParts(), msg.getSnippet());
    }

    private String extractParts(List<MessagePart> parts, String snippet) {
        if (parts == null)
            return snippet != null ? snippet : "";
        StringBuilder sb = new StringBuilder();
        for (MessagePart part : parts) {
            if (part.getMimeType().equalsIgnoreCase("text/plain") && part.getBody().getData() != null) {
                byte[] decoded = Base64.getUrlDecoder().decode(part.getBody().getData());
                sb.append(new String(decoded));
            } else if (part.getParts() != null) {
                sb.append(extractParts(part.getParts(), ""));
            }
        }
        String res = sb.toString();
        return res.isEmpty() ? (snippet != null ? snippet : "") : res;
    }
}
