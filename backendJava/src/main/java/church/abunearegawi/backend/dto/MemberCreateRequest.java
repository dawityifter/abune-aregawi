package church.abunearegawi.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDate;

@Data
public class MemberCreateRequest {
    @NotBlank(message = "First name is required")
    private String firstName;

    @NotBlank(message = "Last name is required")
    private String lastName;

    @Email(message = "Invalid email format")
    private String email;

    private String phoneNumber;

    private String firebaseUid;

    private LocalDate dateOfBirth;

    private String gender;

    private String maritalStatus;

    private String streetLine1;
    private String city;
    private String state;
    private String postalCode;
    private String country;
}
