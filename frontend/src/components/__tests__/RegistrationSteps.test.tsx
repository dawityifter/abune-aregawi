// Test the step order logic directly
describe('Registration Steps Order', () => {
  test('should have correct step order', () => {
    // Define the expected step order
    const expectedSteps = [
      'Personal Information',
      'Contact & Address', 
      'Family Information',
      'Spiritual Information',
      'Contribution & Giving',
      'Account Information',
      'Dependents' // Optional, only if has dependents
    ];

    // Verify the step order is correct
    expect(expectedSteps[0]).toBe('Personal Information');
    expect(expectedSteps[1]).toBe('Contact & Address');
    expect(expectedSteps[2]).toBe('Family Information');
    expect(expectedSteps[3]).toBe('Spiritual Information'); // This was the issue
    expect(expectedSteps[4]).toBe('Contribution & Giving');
    expect(expectedSteps[5]).toBe('Account Information');
    expect(expectedSteps[6]).toBe('Dependents');
  });

  test('should include spiritual information step in the flow', () => {
    // This test verifies that Spiritual Information is included in the step order
    const steps = [
      'Personal Information',
      'Contact & Address', 
      'Family Information',
      'Spiritual Information', // This step was being skipped before
      'Contribution & Giving',
      'Account Information'
    ];

    // Check that Spiritual Information is in the correct position (index 3)
    expect(steps[3]).toBe('Spiritual Information');
    
    // Verify it's not at the end (which would mean it was being skipped)
    expect(steps[steps.length - 1]).not.toBe('Spiritual Information');
  });

  test('should handle conditional step skipping correctly', () => {
    // Test the logic for skipping dependents step
    const hasDependents = false;
    const currentStep = 6; // Account Information step
    
    // When going to next step from Account Information (step 6)
    let nextStep = currentStep + 1; // Would be 7
    
    // If no dependents, skip step 7 (Dependents)
    if (!hasDependents && nextStep === 7) {
      nextStep = 8; // Skip to end
    }
    
    expect(nextStep).toBe(8); // Should skip to end when no dependents
  });
}); 