import React, { useEffect } from 'react';

declare global {
    interface Window {
        chatbase?: any;
    }
}

/**
 * ChatWidget - Recommended script-based integration for Chatbase.
 * This avoids 'frame-ancestors' CSP issues encountered with manual iframes.
 */
const ChatWidget: React.FC = () => {
    useEffect(() => {
        // 1. Initialize the Chatbase global function
        if (!window.chatbase || window.chatbase("getState") !== "initialized") {
            window.chatbase = (...args: any[]) => {
                if (!window.chatbase.q) {
                    window.chatbase.q = [];
                }
                window.chatbase.q.push(args);
            };

            window.chatbase = new Proxy(window.chatbase, {
                get(target, prop) {
                    if (prop === "q") {
                        return target.q;
                    }
                    return (...args: any[]) => target(prop, ...args);
                }
            });
        }

        // 2. Load the official Chatbase Embed Script
        const scriptId = 'chatbase-embed-script';
        if (!document.getElementById(scriptId)) {
            const script = document.createElement("script");
            script.src = "https://www.chatbase.co/embed.min.js";
            script.id = scriptId;
            script.setAttribute('chatbotId', 'Tk-sJVWamI6RB5fUi12Kw');
            script.setAttribute('domain', 'www.chatbase.co');
            script.defer = true;
            document.body.appendChild(script);
        }
    }, []);

    // The script handles its own floating bubble and chat window automatically.
    return null;
};

export default ChatWidget;
