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
        wizzWallet: null, // This will hold the detected wallet object
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
    
    // --- The Definitive, Event-Driven Wallet Detector ---
    let walletDetectionPromise = null;

    function findWizzWallet() {
        // Use a promise to ensure we only run this detection once.
        if (!walletDetectionPromise) {
            walletDetectionPromise = new Promise((resolve, reject) => {
                
                // Set a timeout to act as a final fallback.
                const detectionTimeout = setTimeout(() => {
                    // If, after all events, window.wizz is still not here, we fail with a diagnostic.
                    if (window.wizz && window.wizz.isInstalled) {
                        resolve(window.wizz);
                    } else if (window.ethereum) {
                        reject(new Error("Conflict Detected: MetaMask (or another wallet) is active, but Wizz Wallet did not load. Please try disabling other wallet extensions and refresh."));
                    } else {
                        reject(new Error("Wizz Wallet not found. Please ensure it is installed, enabled, and your browser is up to date."));
                    }
                }, 3000); // Wait a generous 3 seconds.

                // The PRIMARY method: Listen for the official event from the wallet.
                window.addEventListener('wizz.installed', () => {
                    console.log("`wizz.installed` event detected!");
                    clearTimeout(detectionTimeout); // Success, cancel the fallback timeout.
                    if (window.wizz && window.wizz.isInstalled) {
                        resolve(window.wizz);
                    } else {
                        reject(new Error("Wallet event fired, but `window.wizz` is not available."));
                    }
                }, { once: true }); // Listen only once.

                // The SECONDARY method: Check after the entire page has loaded.
                window.addEventListener('load', () => {
                    setTimeout(() => { // Give it a tiny extra moment after load
                        if (window.wizz && window.wizz.isInstalled) {
                            console.log("Wizz Wallet found on page load.");
                            clearTimeout(detectionTimeout);
                            resolve(window.wizz);
                        }
                    }, 100);
                }, { once: true });
            });
        }
        return walletDetectionPromise;
    }

    async function handleConnectWallet() {
        connectWalletBtn.disabled = true;
        connectWalletBtn.textContent = 'Scanning...';

        try {
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
_            showNotification(error.message, 'error', 12000);
            connectWalletBtn.disabled = false;
            connectWalletBtn.textContent = 'Retry Connection';
            // Reset the promise on failure, allowing the user to try again.
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
        }).catch((err) => {
            // Don't show an error here, just log it. The user will see the error when they click the button.
            console.warn("Wizz Wallet not found on initial scan:", err.message);
        });
    };

    init();
});