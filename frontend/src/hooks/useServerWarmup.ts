import { useEffect, useRef } from 'react';

// Silent logger that can be toggled for debugging
const logger = {
  log: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ServerWarmup]', ...args);
    }
  },
  error: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[ServerWarmup]', ...args);
    }
  }
};

const useServerWarmup = () => {
  const controllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Don't run in test environment
    if (process.env.NODE_ENV === 'test') return;

    try {
      // Create a new AbortController for this request
      controllerRef.current = new AbortController();
      const { signal } = controllerRef.current;

      // Function to ping the server - completely silent in production
      const pingServer = async () => {
        try {
          // Use a very short fetch timeout (5s) to avoid hanging
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          await fetch('https://abune-aregawi-firebase.onrender.com/api/ready', {
            ...(signal && { signal }), // Only add signal if it exists
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
            credentials: 'omit', // Don't send cookies
            mode: 'no-cors' // Don't care about CORS
          });
          
          clearTimeout(timeoutId);
          logger.log('Server warm-up request completed');
        } catch (error: any) {
          // Silently handle all errors
          if (error.name !== 'AbortError') {
            logger.error('Warm-up request failed silently:', error.message);
          }
        }
      };

      // Start the warmup
      pingServer();

      // Set a timeout to abort the request after 15 seconds
      timeoutRef.current = setTimeout(() => {
        if (controllerRef.current) {
          logger.log('Warm-up request timed out');
          controllerRef.current.abort();
        }
      }, 15000);

    } catch (error) {
      // Catch any synchronous errors during setup
      logger.error('Error setting up warm-up request:', error);
    }

    // Cleanup function to abort the request if the component unmounts
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []); // Empty dependency array means this effect runs once on mount
};

export default useServerWarmup;
