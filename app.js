// --- Application Main ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Signet Configuration ---
    const config = {
        NETWORK: 'signet',
        NOSTR_RELAY_URL: 'wss://relay.damus.io',
        KIND_ORDER_INTENT: 1004, // Final Nostr kind for gasless signed orders
    };

    // --- State Management ---
    const state = {
        connected: false,
        address: null,
        publicKey: null,
        balances: {},
        orderBook: [], // Stores off-chain signed orders
        nostrSub: null,
        wizzWallet: null,
    };

    // --- DOM Elements ---
    const connectWalletBtn = document.getElementById('connect-wallet-btn');
    const walletInfoDiv = document.getElementById('wallet-info');
    const walletAddressSpan = document.getElementById('wallet-address');
    const swapBtn = document.getElementById('swap-btn');
    const fromAmountInput = document.getElementById('from-amount');
    const toAmountInput = document.getElementById('to-amount');
    const fromTokenSelect = document.getElementById('from-token-select');
    const toTokenSelect = document.getElementById('to-token-select');
    const fromBalanceDiv = document.getElementById('from-balance');
    const toBalanceDiv = document.getElementById('to-balance');
    const orderBookDiv = document.getElementById('order-book-display');
    const notificationToast = document.getElementById('notification-toast');
    const confirmationModal = document.getElementById('confirmation-modal');
    const swapSummaryDiv = document.getElementById('swap-summary');
    const confirmSwapBtn = document.getElementById('confirm-swap-btn');
    const cancelSwapBtn = document.getElementById('cancel-swap-btn');

    let relay = null;

    // --- UI Update & Helper Functions ---
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

    const updateWalletUI = () => {
        if (state.connected) {
            connectWalletBtn.classList.add('hidden');
            walletInfoDiv.classList.remove('hidden');
            const addr = state.address;
            walletAddressSpan.textContent = `Signet: ${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
            swapBtn.textContent = 'Create Gasless Order';
            swapBtn.disabled = false;
        } else {
            connectWalletBtn.classList.remove('hidden');
            walletInfoDiv.classList.add('hidden');
            swapBtn.textContent = 'Connect Wallet';
            swapBtn.disabled = true;
        }
    };
    
    // ... Other UI functions remain the same ...

    // --- Robust Wallet Detection & Connection ---
    const getWizzWallet = () => {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 15; // Wait up to 3 seconds
            const interval = setInterval(() => {
                if (window.wizz && window.wizz.isInstalled) {
                    clearInterval(interval);
                    resolve(window.wizz);
                } else {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        clearInterval(interval);
                        // Provide a much more helpful error message
                        reject(new Error("Wizz Wallet not found. A conflict with another wallet (like MetaMask or Yours Wallet) may be preventing it from loading. Please try disabling other wallet extensions and refresh the page."));
                    }
                }
            }, 200);
        });
    };

    const handleConnectWallet = async () => {
        try {
            const wizz = await getWizzWallet();
            state.wizzWallet = wizz;
            
            const networkState = await state.wizzWallet.getNetwork();
            if (networkState.network.toLowerCase() !== config.NETWORK) {
                showNetworkSwitchModal();
                return;
            }

            const accounts = await state.wizzWallet.requestAccounts();
            state.connected = true;
            state.address = accounts[0];
            state.balances = await state.wizzWallet.getBalances();
            state.publicKey = await state.wizzWallet.getPublicKey();
            
            updateWalletUI();
            showNotification('Signet Wallet Connected!', 'success');
            // connectNostr(); // Connect to P2P network

        } catch (error) {
            console.error(error);
            showNotification(error.message, 'error', 10000);
        }
    };

    // --- Initialization ---
    const init = () => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/nostr-tools/lib/nostr.bundle.js';
        script.onload = () => console.log("Nostr Tools loaded.");
        document.body.appendChild(script);

        // Curated Signet Token List
        const signetTokens = ['SAT', 'TEST', 'ATOM'];
        signetTokens.forEach(ticker => {
            fromTokenSelect.add(new Option(ticker, ticker));
            toTokenSelect.add(new Option(ticker, ticker));
        });
        if(fromTokenSelect.options.length > 1) {
            fromTokenSelect.value = 'SAT';
            toTokenSelect.value = 'TEST';
        }
        
        // Event Listeners
        connectWalletBtn.addEventListener('click', handleConnectWallet);
        cancelSwapBtn.addEventListener('click', () => confirmationModal.classList.add('hidden'));
    };

    init();
});