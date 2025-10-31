// frontend/theme-switcher-and-dashboard-init.js (Combined Startup Logic)

document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle'); 
    
    // --- 1. THEME TOGGLE UTILITY ---
    
    // Function to set the theme and update the button icon
    const setTheme = (theme) => {
        body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (themeToggle) {
            themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙'; 
            themeToggle.setAttribute('title', theme === 'dark' ? 'Toggle Light Mode' : 'Toggle Dark Mode');
        }
    };

    // Check for a saved theme preference on page load (Theme Persistence)
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme);
    } else {
        setTheme('light');
    }

    // Add event listener to toggle theme on button click
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = body.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            setTheme(newTheme);
        });
    }

    // --- 2. AUTHENTICATION GUARD (Applicable to Dashboard/Salon Dashboard/Profile) ---
    function checkAuthentication() {
        const jwtToken = localStorage.getItem('authToken');
        // NOTE: Use 'salonAuthToken' for the Salon Dashboard specific check
        
        if (!jwtToken) {
            // For general dashboard access, redirect unauthenticated users
            if (window.location.pathname.includes('dashboard.html') || window.location.pathname.includes('profile.html')) {
                console.warn('Authentication failed. Redirecting.');
                localStorage.clear();
                window.location.href = 'frontpage.html';
                return false;
            }
        }
        return true;
    }
    
    if (!checkAuthentication()) {
        return; // Stop further JS execution if not authenticated
    }
    
    // --- 3. SIDEBAR AND LOGOUT INITIALIZATION (Applicable to all sidebar pages) ---
    
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleBtn');

    if (sidebar) {
        // A. Load saved sidebar state (desktop only)
        if (window.innerWidth > 768) {
            const savedSidebarState = localStorage.getItem('sidebarState');
            if (savedSidebarState === 'collapsed') {
                sidebar.classList.add('collapsed');
            }
        }

        // B. Toggle behavior
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.toggle('active');
                    document.body.classList.toggle('sidebar-active');
                } else {
                    sidebar.classList.toggle('collapsed');
                    localStorage.setItem('sidebarState', sidebar.classList.contains('collapsed') ? 'collapsed' : 'expanded');
                }
            });
        }
        
        // C. Logout and Active Link Handlers
        document.querySelectorAll('li[data-action="logout"] a').forEach(anchor => {
             anchor.addEventListener('click', (e) => {
                e.preventDefault(); 
                localStorage.clear();
                alert('You have been logged out.'); 
                window.location.href = 'frontpage.html';
             });
        });
        
        // D. Highlight Active Page (This runs on Dashboard and Salon Dashboard)
        const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
        document.querySelectorAll('.sidebar li').forEach(li => {
             li.classList.toggle('active', li.getAttribute('data-page') === currentPage);
        });
        
        // E. Load User Greeting (Applies to Dashboard/Salon Dashboard)
        const userName = localStorage.getItem('userName') || localStorage.getItem('salonName') || 'Valued User';
        const userNameDisplay = document.getElementById('userName');
        if (userNameDisplay) {
            userNameDisplay.textContent = `Welcome, ${userName}!`;
        }
    }
});