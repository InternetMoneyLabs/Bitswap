// --- Application Main ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Configuration ---
    const config = {
        NETWORK: 'signet',
    };

    // --- State Management ---
    const state = {
        connected: false,
        address: null,
        publicKey: null,
        balances: {},
        wizzWallet: null,
    };

    // --- DOM Elements ---
    const connectWalletBtn = document.getElementById('connect-wallet-btn');
    const walletInfoDiv = document.getElementById('wallet-info');
    const walletAddressSpan = document.getElementById('wallet-address');
    const swapBtn = document.getElementById('swap-btn');
    const notificationToast = document.getElementById('notification-toast');
    const confirmationModal = document.getElementById('confirmation-modal');
    const swapSummaryDiv = document.getElementById('swap-summary');
    const confirmSwapBtn = document.getElementById('confirm-swap-btn');
    const cancelSwapBtn = document.getElementById('cancel-swap-btn');
    const fromTokenSelect = document.getElementById('from-token-select');
    const toTokenSelect = document.getElementById('to-token-select');


    // --- UI & Helper Functions ---
    const showNotification = (message, type = 'info', duration = 5000) => {
        notificationToast.textContent = message;
        notificationToast.className = `show ${type}`;
        setTimeout(() => notificationToast.className = 'hidden', duration);
    };

    const showNetworkSwitchModal = () => {
        swapSummaryDiv.innerHTML = `
            <p style="font-size: 1.2rem; font-weight: bold;">Incorrect Network Detected</p>
            <p>Your Wizz Wallet is on Mainnet. BitSwap's test version requires the <strong>Signet</strong> network.</p>
            <div style="text-align: left; margin-top: 1rem; background: #2a2a2a; padding: 1rem; border-radius: 8px;">
                <strong>How to Switch:</strong>
                <ol style="padding-left: 20px; margin-top: 0.5rem;">
                    <li>Open your Wizz Wallet extension.</li>
                    <li>Click the Settings icon (⚙️).</li>
                    <li>Select "Network".</li>
                    <li>Choose "Signet" from the list.</li>
                    <li>Refresh this page.</li>
                </ol>
            </div>
        `;
        confirmSwapBtn.classList.add('hidden');
        cancelSwapBtn.textContent = 'Close';
        confirmationModal.classList.remove('hidden');
    };
    
    // --- Definitive Multi-Stage Wallet Detector ---
    let walletDetectionPromise = null;

    function findWizzWallet() {
        if (walletDetectionPromise) {
            return walletDetectionPromise;
        }

        walletDetectionPromise = new Promise((resolve, reject) => {
            const startDetection = () => {
                let attempts = 0;
                const maxAttempts = 15; // Wait up to 3 seconds

                const interval = setInterval(() => {
                    if (window.wizz && window.wizz.isInstalled) {
                        clearInterval(interval);
                        console.log("Wizz Wallet detected successfully.");
                        return resolve(window.wizz);
                    }
                    
                    attempts++;

                    if (attempts >= maxAttempts) {
                        clearInterval(interval);
                        // Intelligent Error Reporting after failing
                        if (window.ethereum) {
                            reject(new Error("Conflict Detected: Another wallet (like MetaMask) is active, but Wizz Wallet is not responding. Please try disabling other wallet extensions and refresh."));
                        } else {
                            reject(new Error("Wizz Wallet not found. Please ensure it is installed, enabled, and that your browser is up to date."));
                        }
                    }
                }, 200);
            };

            // Wait for the entire window to load before starting detection
            if (document.readyState === 'complete') {
                startDetection();
            } else {
                window.addEventListener('load', startDetection, { once: true });
            }
        });
        
        return walletDetectionPromise;
    }


    async function handleConnectWallet() {
        try {
            connectWalletBtn.disabled = true;
            connectWalletBtn.textContent = 'Scanning...';
            
            const wizz = await findWizzWallet();
            state.wizzWallet = wizz;
            
            const networkState = await state.wizzWallet.getNetwork();
            if (networkState.network.toLowerCase() !== config.NETWORK) {
                showNetworkSwitchModal();
                connectWalletBtn.disabled = false;
                connectWalletBtn.textContent = 'Connect Wallet';
                return;
            }

            const accounts = await state.wizzWallet.requestAccounts();
            state.connected = true;
            state.address = accounts[0];
            state.balances = await state.wizzWallet.getBalances();
            state.publicKey = await state.wizzWallet.getPublicKey();
            
            updateWalletUI();
            showNotification('Signet Wallet Connected!', 'success');

        } catch (error) {
            console.error(error);
            showNotification(error.message, 'error', 12000);
            connectWalletBtn.disabled = false;
            connectWalletBtn.textContent = 'Retry Connection';
            // Reset promise to allow re-scanning
            walletDetectionPromise = null;
        }
    };
    
    // --- UI Functions ---
    function updateWalletUI() {
        if (state.connected) {
            connectWalletBtn.classList.add('hidden');
            walletInfoDiv.classList.remove('hidden');
            const addr = state.address;
            walletAddressSpan.textContent = `Signet: ${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
            swapBtn.textContent = 'Create Order';
            swapBtn.disabled = false;
        } else {
            connectWalletBtn.classList.remove('hidden');
            walletInfoDiv.classList.add('hidden');
            swapBtn.textContent = 'Connect Wallet';
            swapBtn.disabled = true;
        }
    };

    // --- Initialization ---
    const init = () => {
        // Populate static UI elements
        const signetTokens = ['SAT', 'TEST', 'ATOM', 'BTC'];
        signetTokens.forEach(ticker => {
            fromTokenSelect.add(new Option(ticker, ticker));
            toTokenSelect.add(new Option(ticker, ticker));
        });
        if(fromTokenSelect.options.length > 1) {
            fromTokenSelect.value = 'SAT';
            toTokenSelect.value = 'TEST';
        }
        
        // Setup Event Listeners
        connectWalletBtn.addEventListener('click', handleConnectWallet);
        cancelSwapBtn.addEventListener('click', () => confirmationModal.classList.add('hidden'));

        // Pre-emptively start looking for the wallet on page load
        findWizzWallet().then(wizz => {
            state.wizzWallet = wizz;
            console.log("Wizz Wallet pre-emptively detected.");
            showNotification("Wizz Wallet detected! Click 'Connect' to proceed.", 'info');
        }).catch(() => {
            console.warn("Wizz Wallet not found on initial scan. Waiting for user action.");
        });
    };

    init();
});