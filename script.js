// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all functionality
    initializeForms();
    initializeSmoothScrolling();
    initializeLanguageToggle();
    initializeEmergencyAlerts();
    initializeVideoPlayer();
    initializeMobileMenu();
});

// Form handling
function initializeForms() {
    // Connect form submission
    const connectForm = document.querySelector('.connect-form');
    if (connectForm) {
        connectForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleFormSubmission(this, 'Thank you for connecting with us! We will get back to you soon.');
        });
    }

    // RSVP buttons
    const rsvpButtons = document.querySelectorAll('.btn-small');
    rsvpButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const eventName = this.closest('.event-card').querySelector('h3').textContent;
            showModal(`RSVP for ${eventName}`, createRSVPForm());
        });
    });

    // CTA buttons
    const ctaButtons = document.querySelectorAll('.cta-buttons .btn');
    ctaButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const action = this.textContent.trim();
            handleCTAAction(action);
        });
    });
}

// Handle form submissions
function handleFormSubmission(form, successMessage) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Simulate form submission
    showLoading(form);
    
    setTimeout(() => {
        hideLoading(form);
        showSuccessMessage(successMessage);
        form.reset();
    }, 2000);
}

// Show loading state
function showLoading(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
}

// Hide loading state
function hideLoading(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.innerHTML = submitBtn.getAttribute('data-original-text') || 'Send Message';
}

// Show success message
function showSuccessMessage(message) {
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Create RSVP form
function createRSVPForm() {
    return `
        <form class="rsvp-form">
            <input type="text" name="name" placeholder="Your Name" required>
            <input type="email" name="email" placeholder="Email Address" required>
            <input type="tel" name="phone" placeholder="Phone Number">
            <select name="attending" required>
                <option value="">Will you attend?</option>
                <option value="yes">Yes, I will attend</option>
                <option value="maybe">Maybe, I'll let you know</option>
                <option value="no">No, I cannot attend</option>
            </select>
            <textarea name="message" placeholder="Any special requirements or questions?"></textarea>
            <button type="submit" class="btn btn-primary">Submit RSVP</button>
        </form>
    `;
}

// Handle CTA actions
function handleCTAAction(action) {
    switch(action) {
        case 'Plan a Visit':
            showModal('Plan Your Visit', createVisitForm());
            break;
        case 'Watch Live':
            window.open('https://www.facebook.com/abunearegawitx/', '_blank');
            break;
        case 'Give Online':
            showModal('Online Giving', createDonationForm());
            break;
        case 'View Dues / Login':
            showModal('Member Login', createLoginForm());
            break;
    }
}

// Create visit form
function createVisitForm() {
    return `
        <form class="visit-form">
            <input type="text" name="name" placeholder="Your Name" required>
            <input type="email" name="email" placeholder="Email Address" required>
            <input type="tel" name="phone" placeholder="Phone Number">
            <input type="date" name="visitDate" required>
            <select name="service" required>
                <option value="">Which service would you like to attend?</option>
                <option value="sunday">Sunday Service (9:00 AM)</option>
                <option value="wednesday">Wednesday Service (6:00 PM)</option>
                <option value="friday">Friday Service (6:00 PM)</option>
            </select>
            <textarea name="message" placeholder="Tell us about yourself and what brings you to visit"></textarea>
            <button type="submit" class="btn btn-primary">Submit Visit Request</button>
        </form>
    `;
}

// Create donation form
function createDonationForm() {
    return `
        <form class="donation-form">
            <div class="donation-options">
                <label>
                    <input type="radio" name="donationType" value="one-time" checked>
                    One-time donation
                </label>
                <label>
                    <input type="radio" name="donationType" value="recurring">
                    Recurring donation
                </label>
            </div>
            <select name="amount" required>
                <option value="">Select amount</option>
                <option value="25">$25</option>
                <option value="50">$50</option>
                <option value="100">$100</option>
                <option value="250">$250</option>
                <option value="500">$500</option>
                <option value="custom">Custom amount</option>
            </select>
            <input type="number" name="customAmount" placeholder="Custom amount" style="display: none;">
            <select name="purpose">
                <option value="general">General Fund</option>
                <option value="building">Building Fund</option>
                <option value="mission">Mission Fund</option>
                <option value="youth">Youth Ministry</option>
            </select>
            <input type="text" name="name" placeholder="Your Name" required>
            <input type="email" name="email" placeholder="Email Address" required>
            <button type="submit" class="btn btn-primary">Proceed to Payment</button>
        </form>
    `;
}

// Create login form
function createLoginForm() {
    return `
        <form class="login-form">
            <input type="email" name="email" placeholder="Email Address" required>
            <input type="password" name="password" placeholder="Password" required>
            <div class="form-options">
                <label>
                    <input type="checkbox" name="remember">
                    Remember me
                </label>
                <a href="#" class="forgot-password">Forgot Password?</a>
            </div>
            <button type="submit" class="btn btn-primary">Login</button>
            <p class="login-footer">
                Don't have an account? <a href="#" class="register-link">Register here</a>
            </p>
        </form>
    `;
}

// Modal functionality
function showModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="closeModal(this)">×</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners to form in modal
    const form = modal.querySelector('form');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            handleFormSubmission(this, 'Thank you! Your submission has been received.');
        });
        
        // Handle custom amount field
        const amountSelect = form.querySelector('select[name="amount"]');
        const customAmount = form.querySelector('input[name="customAmount"]');
        if (amountSelect && customAmount) {
            amountSelect.addEventListener('change', function() {
                if (this.value === 'custom') {
                    customAmount.style.display = 'block';
                    customAmount.required = true;
                } else {
                    customAmount.style.display = 'none';
                    customAmount.required = false;
                }
            });
        }
    }
    
    // Close modal on outside click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal(modal.querySelector('.modal-close'));
        }
    });
}

function closeModal(closeButton) {
    const modal = closeButton.closest('.modal');
    modal.remove();
}

// Smooth scrolling
function initializeSmoothScrolling() {
    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

    // Language toggle functionality
function initializeLanguageToggle() {
    // This would be implemented with a language switcher
    // For now, we'll add a simple language indicator
    const heroSubtitle = document.querySelector('.hero-subtitle');
    if (heroSubtitle) {
        heroSubtitle.addEventListener('click', function() {
            // Toggle between English and Tigrigna
            if (this.textContent.includes('እንኳዕ')) {
                this.textContent = 'Welcome to Abune Aregawi Tigray Orthodox Church';
            } else {
                this.textContent = 'እንኳዕ ናብ ቤተ ክርስትያን ኦርቶዶክስ ትግራይ ኣቡነ ኣረጋዊ ብደሓን መጻእኩም!';
            }
        });
    }
}

// Emergency alerts
function initializeEmergencyAlerts() {
    // Simulate emergency alert system
    const emergencyAlert = document.createElement('div');
    emergencyAlert.className = 'emergency-alert';
    emergencyAlert.innerHTML = `
        <div class="alert-content">
            <i class="fas fa-exclamation-triangle"></i>
            <span>Important: Special prayer service this Friday at 7:00 PM</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Only show if no emergency alert exists
    if (!document.querySelector('.emergency-alert')) {
        document.body.insertBefore(emergencyAlert, document.body.firstChild);
    }
}

// Video player functionality
function initializeVideoPlayer() {
    const videoPlaceholder = document.querySelector('.video-placeholder');
    if (videoPlaceholder) {
        videoPlaceholder.addEventListener('click', function() {
            // Simulate video player
            this.innerHTML = `
                <div class="video-playing">
                    <i class="fas fa-play"></i>
                    <p>Video would start playing here</p>
                    <small>Click to pause</small>
                </div>
            `;
        });
    }
}

// Mobile menu functionality
function initializeMobileMenu() {
    // Add mobile menu toggle if needed
    const menuToggle = document.createElement('button');
    menuToggle.className = 'mobile-menu-toggle';
    menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
    menuToggle.style.display = 'none';
    
    // Show on mobile
    if (window.innerWidth <= 768) {
        menuToggle.style.display = 'block';
    }
    
    window.addEventListener('resize', function() {
        if (window.innerWidth <= 768) {
            menuToggle.style.display = 'block';
        } else {
            menuToggle.style.display = 'none';
        }
    });
}

// Add CSS for modal and notifications
const additionalStyles = `
    .modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }
    
    .modal-content {
        background: white;
        border-radius: 12px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem;
        border-bottom: 1px solid #eee;
    }
    
    .modal-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
    }
    
    .modal-body {
        padding: 1.5rem;
    }
    
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        padding: 1rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 0.5rem;
        z-index: 1001;
        max-width: 300px;
    }
    
    .notification.success {
        border-left: 4px solid #28a745;
    }
    
    .notification button {
        background: none;
        border: none;
        cursor: pointer;
        color: #666;
    }
    
    .emergency-alert {
        background: #dc3545;
        color: white;
        padding: 0.75rem;
        text-align: center;
    }
    
    .alert-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        max-width: 1200px;
        margin: 0 auto;
    }
    
    .alert-content button {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 1.2rem;
    }
    
    .video-playing {
        text-align: center;
        color: white;
    }
    
    .video-playing i {
        font-size: 3rem;
        color: #DAA520;
        margin-bottom: 1rem;
    }
    
    form {
        display: grid;
        gap: 1rem;
    }
    
    form input,
    form select,
    form textarea {
        padding: 12px;
        border: 2px solid #eee;
        border-radius: 8px;
        font-size: 1rem;
    }
    
    form input:focus,
    form select:focus,
    form textarea:focus {
        outline: none;
        border-color: #8B4513;
    }
    
    .donation-options {
        display: grid;
        gap: 0.5rem;
    }
    
    .donation-options label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .form-options {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .forgot-password,
    .register-link {
        color: #8B4513;
        text-decoration: none;
    }
    
    .login-footer {
        text-align: center;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #eee;
    }
    
    @media (max-width: 768px) {
        .modal-content {
            width: 95%;
            margin: 20px;
        }
        
        .notification {
            right: 10px;
            left: 10px;
            max-width: none;
        }
    }
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet); 