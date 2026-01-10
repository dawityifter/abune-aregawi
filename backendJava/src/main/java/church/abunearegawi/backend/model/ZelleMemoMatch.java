package church.abunearegawi.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "zelle_memo_matches")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ZelleMemoMatch {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "first_name", length = 100)
    private String firstName;

    @Column(name = "last_name", length = 100)
    private String lastName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String memo;
}
