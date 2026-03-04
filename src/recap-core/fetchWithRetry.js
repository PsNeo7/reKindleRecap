/**
 * A robust wrapper around the native browser fetch API that automatically
 * retries on network failures, timeouts, and 5xx / 429 server errors
 * using an exponential backoff strategy.
 * 
 * @param {string} url - The URL to fetch
 * @param {Object} options - Standard fetch options struct
 * @param {number} retries - Maximum number of attempts
 * @param {number} backoffMs - Base delay in milliseconds before retrying
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}, retries = 3, backoffMs = 1000) {
    let lastError;

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);

            // If the response is not ok, determine if it's retryable
            if (!response.ok) {
                // 4xx errors are client errors (like Bad Request or Unauthorized).
                // DO NOT retry these, as retrying will not fix a bad API key or bad prompt syntax.
                // EXCEPTION: 429 is Too Many Requests (Rate Limiting), which SHOULD be retried.
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    return response; // Return it so the caller can throw the explicit 401/400 error message
                }

                // For 5xx Server Errors or 429 Rate Limits, force a throw to trigger the catch block & retry logic
                throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }

            // If successful (res.ok), return immediately
            return response;

        } catch (error) {
            lastError = error;
            console.warn(`[Network] Fetch failed (attempt ${i + 1}/${retries}): ${error.message}`);

            // If we have retries left, wait exponentially before the next loop
            if (i < retries - 1) {
                const delay = backoffMs * Math.pow(2, i);
                console.log(`[Network] Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // If we exhaust all retries, throw the final error to the caller so they can surface it in the UI
    throw lastError;
}
