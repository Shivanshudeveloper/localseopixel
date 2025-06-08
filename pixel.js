(function() {
    const currentScript = document.currentScript;
    const domainId = currentScript ? currentScript.getAttribute('data-domain-id') : null;
    
    if (!domainId) {
        console.error("No site ID provided in the script tag.");
        return;
    }
    
    // Safe getter function to handle undefined/null values
    function safeGet(getter, fallback = "NA") {
        try {
            const result = getter();
            return (result !== null && result !== undefined && result !== "") ? result : fallback;
        } catch (error) {
            return fallback;
        }
    }
    
    // Device type detection function with error handling
    function getDeviceType() {
        try {
            const userAgent = safeGet(() => navigator.userAgent?.toLowerCase(), "");
            const screenWidth = safeGet(() => window.screen?.width, 0);
            const screenHeight = safeGet(() => window.screen?.height, 0);
            
            if (!userAgent && screenWidth === 0) {
                return "NA";
            }
            
            const maxDimension = Math.max(screenWidth, screenHeight);
            const minDimension = Math.min(screenWidth, screenHeight);
            
            // Check for mobile devices
            if (userAgent && /mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
                return 'Phone';
            }
            
            // Check for tablets
            if (userAgent && /tablet|ipad|playbook|silk/i.test(userAgent)) {
                return 'Tablet';
            }
            
            // Additional tablet detection for Android tablets
            if (userAgent && /android/i.test(userAgent) && !/mobile/i.test(userAgent)) {
                return 'Tablet';
            }
            
            // Screen size based detection as fallback
            if (maxDimension > 0) {
                if (maxDimension <= 768) {
                    return 'Phone';
                } else if (maxDimension <= 1024 && minDimension <= 768) {
                    return 'Tablet';
                }
                
                // Touch device detection for tablets
                if (safeGet(() => 'ontouchstart' in window, false) && maxDimension <= 1366) {
                    return 'Tablet';
                }
            }
            
            // Default to PC if we have some data
            return userAgent || maxDimension > 0 ? 'PC' : 'NA';
            
        } catch (error) {
            return "NA";
        }
    }
    
    // Get additional device info with comprehensive error handling
    function getDeviceInfo() {
        return {
            deviceType: getDeviceType(),
            screenResolution: safeGet(() => {
                const width = window.screen?.width;
                const height = window.screen?.height;
                return (width && height) ? `${width}x${height}` : "NA";
            }),
            viewportSize: safeGet(() => {
                const width = window.innerWidth;
                const height = window.innerHeight;
                return (width && height) ? `${width}x${height}` : "NA";
            }),
            hasTouch: safeGet(() => 'ontouchstart' in window, false),
            language: safeGet(() => navigator.language || navigator.userLanguage),
            platform: safeGet(() => navigator.platform),
            timezone: safeGet(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
        };
    }
    
    // Safe IP fetch with timeout and error handling
    function getIPAddress() {
        return fetch('https://api.ipify.org?format=json', {
            signal: AbortSignal.timeout(5000) // 5 second timeout for IP
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('IP service unavailable');
            }
            return response.json();
        })
        .then(data => data.ip || "NA")
        .catch(() => "NA"); // Return NA if IP service fails/blocked
    }
    
    // Check if tracking data already exists in localStorage
    function hasBeenTracked(ip, url, activity) {
        try {
            if (typeof Storage === "undefined") {
                return false; // localStorage not supported
            }
            
            const trackingKey = `tracking_${ip}_${url}_${activity}`;
            const tracked = localStorage.getItem(trackingKey);
            return tracked === "true";
        } catch (error) {
            console.warn("localStorage not accessible:", error.message);
            return false; // If localStorage fails, proceed with tracking
        }
    }
    
    // Mark current visit as tracked
    function markAsTracked(ip, url, activity) {
        try {
            if (typeof Storage !== "undefined") {
                const trackingKey = `tracking_${ip}_${url}_${activity}`;
                localStorage.setItem(trackingKey, "true");
                
                // Optional: Set expiration (24 hours)
                const expirationKey = `tracking_exp_${ip}_${url}_${activity}`;
                const expirationTime = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
                localStorage.setItem(expirationKey, expirationTime.toString());
            }
        } catch (error) {
            console.warn("Could not save tracking state:", error.message);
        }
    }
    
    // Clean expired tracking entries
    function cleanExpiredEntries() {
        try {
            if (typeof Storage === "undefined") return;
            
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('tracking_exp_')) {
                    const expirationTime = parseInt(localStorage.getItem(key) || "0");
                    if (Date.now() > expirationTime) {
                        keysToRemove.push(key);
                        // Also remove the corresponding tracking key
                        const trackingKey = key.replace('tracking_exp_', 'tracking_');
                        keysToRemove.push(trackingKey);
                    }
                }
            }
            
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (error) {
            console.warn("Could not clean expired entries:", error.message);
        }
    }
    
    // Create tracking data with safe getters
    function createTrackingData(ip) {
        const deviceInfo = getDeviceInfo();
        
        return {
            domainId: domainId,
            url: safeGet(() => window.location.href),
            referrer: safeGet(() => document.referrer),
            title: safeGet(() => document.title),
            userAgent: safeGet(() => navigator.userAgent),
            timestamp: safeGet(() => new Date().toISOString()),
            ip: ip,
            deviceType: deviceInfo.deviceType,
            screenResolution: deviceInfo.screenResolution,
            viewportSize: deviceInfo.viewportSize,
            hasTouch: deviceInfo.hasTouch,
            language: deviceInfo.language,
            platform: deviceInfo.platform,
            timezone: deviceInfo.timezone,
            activity: "WEBSITE_CLICKED"
        };
    }
    
    // Send tracking data with error handling
    function sendTrackingData(trackingData) {
        return fetch("http://localhost:8080/api/v1/service/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(trackingData),
            signal: AbortSignal.timeout(10000)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
            
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error(`Invalid content type: ${contentType}`);
            }
            
            return response.json();
        })
        .then(result => {
            console.log("Tracking successful:", result);
            return result;
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
            throw error;
        });
    }
    
    // Main execution with comprehensive error handling
    cleanExpiredEntries(); // Clean old entries first
    
    getIPAddress()
        .then(ip => {
            const currentUrl = safeGet(() => window.location.href);
            const activity = "WEBSITE_CLICKED";
            
            // 🔍 Check if this combination has already been tracked
            if (hasBeenTracked(ip, currentUrl, activity)) {
                console.log("✋ Visit already tracked, skipping API request");
                console.log(`📝 Key checked: tracking_${ip}_${currentUrl}_${activity}`);
                return Promise.resolve({ message: "Already tracked", skipped: true });
            }
            
            console.log("🆕 New visit detected, sending tracking data");
            const trackingData = createTrackingData(ip);
            return sendTrackingData(trackingData)
                .then(result => {
                    // ✅ Mark as tracked only after successful API call
                    markAsTracked(ip, currentUrl, activity);
                    console.log(`💾 Saved to localStorage: tracking_${ip}_${currentUrl}_${activity}`);
                    return result;
                });
        })
        .catch(ipError => {
            // If IP fetch fails, continue with tracking without IP
            console.warn("IP detection failed, continuing without IP:", ipError.message);
            
            const currentUrl = safeGet(() => window.location.href);
            const activity = "WEBSITE_CLICKED";
            const fallbackIp = "NA";
            
            // 🔍 Check if this combination has already been tracked (with NA IP)
            if (hasBeenTracked(fallbackIp, currentUrl, activity)) {
                console.log("✋ Visit already tracked (no IP), skipping API request");
                console.log(`📝 Key checked: tracking_${fallbackIp}_${currentUrl}_${activity}`);
                return Promise.resolve({ message: "Already tracked without IP", skipped: true });
            }
            
            console.log("🆕 New visit detected (no IP), sending tracking data");
            const trackingData = createTrackingData(fallbackIp);
            return sendTrackingData(trackingData)
                .then(result => {
                    // ✅ Mark as tracked only after successful API call
                    markAsTracked(fallbackIp, currentUrl, activity);
                    console.log(`💾 Saved to localStorage: tracking_${fallbackIp}_${currentUrl}_${activity}`);
                    return result;
                });
        })
        .catch(trackingError => {
            // Final fallback - even if tracking fails, don't break the page
            console.error("All tracking attempts failed:", trackingError.message);
        });
})();