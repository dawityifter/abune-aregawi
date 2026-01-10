package church.abunearegawi.backend.security;

import church.abunearegawi.backend.model.Member;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
// cleaned up

/**
 * Custom UserDetails implementation that wraps a Member entity.
 * Used by Spring Security to represent an authenticated user.
 */
@Getter
public class FirebaseUserDetails implements UserDetails {

    private final Member member;

    public FirebaseUserDetails(Member member) {
        this.member = member;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        java.util.Set<GrantedAuthority> authorities = new java.util.HashSet<>();

        // 1. Add primary role
        Member.Role role = member.getRole();
        if (role != null) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + role.name().toUpperCase()));
        } else {
            authorities.add(new SimpleGrantedAuthority("ROLE_MEMBER"));
        }

        // 2. Add extra roles from JSON string "[\"admin\", \"treasurer\"]"
        String rolesJson = member.getRoles();
        if (rolesJson != null && rolesJson.length() > 2) {
            // Simple parsing to avoid extra dependencies in this POJO if possible,
            // or we could use Jackson.
            // Format is ["a","b"] or []
            String content = rolesJson.substring(1, rolesJson.length() - 1); // remove [ ]
            if (!content.isBlank()) {
                String[] parts = content.split(",");
                for (String part : parts) {
                    String r = part.trim().replaceAll("\"", "");
                    if (!r.isBlank()) {
                        authorities.add(new SimpleGrantedAuthority("ROLE_" + r.toUpperCase()));
                    }
                }
            }
        }

        return authorities;
    }

    @Override
    public String getPassword() {
        // Not used for Firebase authentication
        return null;
    }

    @Override
    public String getUsername() {
        // Return email as username, or phone if email not available
        return member.getEmail() != null ? member.getEmail() : member.getPhoneNumber();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return member.isActive();
    }

    /**
     * Get the member ID
     */
    public Long getMemberId() {
        return member.getId();
    }

    /**
     * Get the member email
     */
    public String getEmail() {
        return member.getEmail();
    }

    /**
     * Get the member role as a string
     */
    public String getRole() {
        return member.getRole() != null ? member.getRole().name() : "member";
    }
}
