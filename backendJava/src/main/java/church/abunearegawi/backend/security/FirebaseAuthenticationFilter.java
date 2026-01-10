package church.abunearegawi.backend.security;

import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.repository.MemberRepository;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

/**
 * Firebase Authentication Filter that verifies Firebase ID tokens
 * and sets the Spring Security context.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FirebaseAuthenticationFilter extends OncePerRequestFilter {

    private final MemberRepository memberRepository;
    private final FirebaseAuth firebaseAuth;

    @Value("${app.enable-demo-mode:false}")
    private boolean enableDemoMode;

    @Value("${app.demo-token:MAGIC_DEMO_TOKEN}")
    private String demoToken;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
        log.warn("Auth Filter: Processing {} {}", request.getMethod(), path); // Log every request

        try {
            String firebaseToken = extractToken(request);

            // DEMO MODE CHECK (Run BEFORE null token check)
            if (enableDemoMode) {
                log.warn("!!! DEMO DEBUG !!! TokenPresent={}, ConfiguredToken={}", (firebaseToken != null), demoToken);

                // Check if we should bypass based on Header OR Token
                String demoEmail = request.getHeader("X-Demo-Email");
                boolean matchesToken = (firebaseToken != null && demoToken.equals(firebaseToken));
                boolean hasDemoHeader = (demoEmail != null && !demoEmail.isEmpty());

                if (matchesToken || hasDemoHeader) {
                    if (demoEmail == null)
                        demoEmail = "demo@admin.com"; // Default if not sent but token matches

                    log.warn("BYPASSING AUTH: Demo Mode active for email: {}", demoEmail);
                    Optional<Member> memberOpt = memberRepository.findByEmail(demoEmail);

                    if (memberOpt.isPresent()) {
                        Member member = memberOpt.get();
                        FirebaseUserDetails userDetails = new FirebaseUserDetails(member);
                        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                                userDetails,
                                null, userDetails.getAuthorities());
                        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(authentication);

                        log.info("Demo Mode authentication successful for: {}", demoEmail);
                        filterChain.doFilter(request, response);
                        return;
                    } else {
                        log.warn("Demo Mode: Member not found for email: {}", demoEmail);
                        // Proceed as Anonymous so Controller can return 404
                        filterChain.doFilter(request, response);
                        return;
                    }
                }
            }

            if (firebaseToken == null) {
                log.debug("No Firebase token found, continuing without authentication");
                filterChain.doFilter(request, response);
                return;
            }

            FirebaseToken decodedToken = verifyToken(firebaseToken);

            if (decodedToken == null) {
                log.warn("Token verification failed");
                sendUnauthorizedResponse(response, "Invalid or expired authentication token.");
                return;
            }

            Member member = findMemberFromToken(decodedToken);
            if (member == null) {
                log.warn("Member not found for token");
                sendUnauthorizedResponse(response, "Member not found.");
                return;
            }

            if (!member.isActive()) {
                sendUnauthorizedResponse(response, "Account inactive.");
                return;
            }

            FirebaseUserDetails userDetails = new FirebaseUserDetails(member);
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(userDetails,
                    null, userDetails.getAuthorities());
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);

            filterChain.doFilter(request, response);

        } catch (Exception e) {
            log.error("Authentication error", e);
            sendUnauthorizedResponse(response, "Authentication failed: " + e.getMessage());
        }
    }

    /**
     * Extract Bearer token from Authorization header
     */
    private String extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        return null;
    }

    /**
     * Verify Firebase token and return decoded token
     */
    private FirebaseToken verifyToken(String token) {
        try {
            // Demo mode check
            if (enableDemoMode && demoToken.equals(token)) {
                log.warn("⚠️ Demo mode is enabled - bypassing Firebase token verification!");
                log.warn("⚠️ This should NOT be active in production!");
                // Return a mock token for demo purposes
                return createDemoToken();
            }

            return firebaseAuth.verifyIdToken(token);

        } catch (FirebaseAuthException e) {
            log.error("Firebase token verification failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Create a demo token for testing (only when demo mode is enabled)
     */
    private FirebaseToken createDemoToken() {
        return null; // Mock implementation
    }

    /**
     * Find member from decoded Firebase token
     */
    private Member findMemberFromToken(FirebaseToken decodedToken) {
        String email = decodedToken.getEmail();
        String phoneNumber = decodedToken.getClaims().get("phone_number") != null
                ? decodedToken.getClaims().get("phone_number").toString()
                : null;

        log.debug("Looking up member by email: {} or phone: {}", email, phoneNumber);

        // Normalize phone number
        if (phoneNumber != null && !phoneNumber.startsWith("+")) {
            phoneNumber = "+" + phoneNumber;
        }

        Optional<Member> memberOpt = memberRepository.findByEmailOrPhone(email, phoneNumber);

        return memberOpt.orElse(null);
    }

    /**
     * Send unauthorized response
     */
    private void sendUnauthorizedResponse(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write(String.format(
                "{\"success\": false, \"message\": \"%s\"}", message));
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // Remove firebase profile path from exclusion to ensure Demo Login works for it
        return path.equals("/api/ready") ||
                path.equals("/api/health") ||
                path.startsWith("/api/members/register");
    }
}
