(function() {
    const currentScript = document.currentScript;
    const domainId = currentScript ? currentScript.getAttribute('data-domain-id') : null;
    
    if (!domainId) {
        console.error("No site ID provided in the script tag.");
        return;
    }
    
    // Device type detection function
    function getDeviceType() {
        const userAgent = navigator.userAgent.toLowerCase();
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        const maxDimension = Math.max(screenWidth, screenHeight);
        const minDimension = Math.min(screenWidth, screenHeight);
        
        // Check for mobile devices
        if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
            return 'Phone';
        }
        
        // Check for tablets
        if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
            return 'Tablet';
        }
        
        // Additional tablet detection for Android tablets
        if (/android/i.test(userAgent) && !/mobile/i.test(userAgent)) {
            return 'Tablet';
        }
        
        // Screen size based detection as fallback
        if (maxDimension <= 768) {
            return 'Phone';
        } else if (maxDimension <= 1024 && minDimension <= 768) {
            return 'Tablet';
        }
        
        // Touch device detection for tablets
        if ('ontouchstart' in window && maxDimension <= 1366) {
            return 'Tablet';
        }
        
        // Default to PC
        return 'PC';
    }
    
    // Get additional device info
    function getDeviceInfo() {
        return {
            deviceType: getDeviceType(),
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            hasTouch: 'ontouchstart' in window,
            language: navigator.language,
            platform: navigator.platform,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    }
    
    // Get IP address first
    fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => {
            const deviceInfo = getDeviceInfo();
            
            const trackingData = {
                domainId,
                url: window.location.href,
                referrer: document.referrer,
                title: document.title,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
                ip: data.ip,
                // Added device information
                deviceType: deviceInfo.deviceType,
                screenResolution: deviceInfo.screenResolution,
                viewportSize: deviceInfo.viewportSize,
                hasTouch: deviceInfo.hasTouch,
                language: deviceInfo.language,
                platform: deviceInfo.platform,
                timezone: deviceInfo.timezone
            };
            
            // Enhanced fetch with proper error handling
            return fetch("http://localhost:8080/api/v1/service/track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(trackingData),
                // Add timeout (10 seconds)
                signal: AbortSignal.timeout(10000)
            })
            .then(response => {
                // Check if response is ok (status 200-299)
                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
                }
                
                // Check content type
                const contentType = response.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error(`Invalid content type: ${contentType}`);
                }
                
                return response.json();
            })
            .then(result => {
                // Success - optional success logging
                console.log("Tracking successful:", result);
            })
            .catch(error => {
                // Detailed error handling
                if (error.name === 'AbortError') {
                    console.error("Tracking request timed out after 10 seconds");
                } else if (error.message.includes('HTTP Error')) {
                    console.error("Server error:", error.message);
                } else if (error.message.includes('Failed to fetch')) {
                    console.error("Network error - check internet connection or CORS settings");
                } else if (error.message.includes('Invalid content type')) {
                    console.error("Server returned invalid response format:", error.message);
                } else {
                    console.error("Tracking request failed:", error.message);
                }
            });
        })
        .catch(err => {
            console.error("Failed to get IP address:", err.message);
            
            const deviceInfo = getDeviceInfo();
            
            // Fallback: Send tracking data without IP
            const trackingDataNoIP = {
                domainId,
                url: window.location.href,
                referrer: document.referrer,
                title: document.title,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
                ip: null,
                // Added device information
                deviceType: deviceInfo.deviceType,
                screenResolution: deviceInfo.screenResolution,
                viewportSize: deviceInfo.viewportSize,
                hasTouch: deviceInfo.hasTouch,
                language: deviceInfo.language,
                platform: deviceInfo.platform,
                timezone: deviceInfo.timezone
            };
            
            fetch("http://localhost:8080/api/v1/service/track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(trackingDataNoIP),
                signal: AbortSignal.timeout(10000)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
                }
                return response.json();
            })
            .then(result => {
                console.log("Tracking successful (without IP):", result);
            })
            .catch(trackError => {
                if (trackError.name === 'AbortError') {
                    console.error("Fallback tracking request timed out");
                } else {
                    console.error("Fallback tracking also failed:", trackError.message);
                }
            });
        });
})();