package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.Employee;
import church.abunearegawi.backend.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EmployeeService {

    private final EmployeeRepository employeeRepository;

    @Transactional(readOnly = true)
    public List<Employee> findAll(Boolean isActive) {
        if (isActive != null) {
            return employeeRepository.findByIsActiveOrderByLastNameAscFirstNameAsc(isActive);
        }
        return employeeRepository.findAllByOrderByLastNameAscFirstNameAsc();
    }

    @Transactional(readOnly = true)
    public Optional<Employee> findById(UUID id) {
        return employeeRepository.findById(id);
    }

    @Transactional
    public Employee create(Employee employee) {
        return employeeRepository.save(employee);
    }

    @Transactional
    public Employee update(UUID id, Employee details) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Employee not found: " + id));

        employee.setFirstName(details.getFirstName());
        employee.setLastName(details.getLastName());
        employee.setPosition(details.getPosition());
        employee.setEmploymentType(details.getEmploymentType());
        employee.setEmail(details.getEmail());
        employee.setPhoneNumber(details.getPhoneNumber());
        employee.setAddress(details.getAddress());
        employee.setSsnLastFour(details.getSsnLastFour());
        employee.setHireDate(details.getHireDate());
        employee.setTerminationDate(details.getTerminationDate());
        employee.setSalaryAmount(details.getSalaryAmount());
        employee.setSalaryFrequency(details.getSalaryFrequency());
        employee.setActive(details.isActive());
        employee.setTaxId(details.getTaxId());
        employee.setNotes(details.getNotes());

        return employeeRepository.save(employee);
    }

    @Transactional
    public void delete(UUID id) {
        employeeRepository.deleteById(id);
    }
}
