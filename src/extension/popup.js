document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('apiKey');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');

    // Load existing config
    const config = await chrome.storage.local.get(['apiKey']);
    if (config.apiKey) {
        apiKeyInput.value = config.apiKey;
    }

    saveBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            status.textContent = "Please enter an API key.";
            status.className = "status";
            return;
        }

        await chrome.storage.local.set({ apiKey });

        status.textContent = "✅ Configuration saved!";
        status.className = "status success";

        setTimeout(() => {
            status.textContent = "";
        }, 2000);
    });

    document.getElementById('testBtn').addEventListener('click', async () => {
        const testResult = document.getElementById('testResult');
        testResult.textContent = "⌛ Testing...";
        testResult.style.color = "#888";

        chrome.runtime.sendMessage({
            type: 'GET_RECAP',
            payload: { title: "Test", text: "Explain the concept of a book recap in one sentence." }
        }, (response) => {
            if (response && response.recap) {
                testResult.textContent = "✅ Success! AI is connected.";
                testResult.style.color = "#4caf50";
            } else {
                testResult.textContent = `❌ Failed: ${response?.error || 'Unknown error'}`;
                testResult.style.color = "#ff5252";
            }
        });
    });
});
