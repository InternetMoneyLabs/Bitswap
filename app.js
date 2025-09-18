// --- Application Main ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Signet Configuration ---
    const config = {
        NETWORK: 'signet',
        NOSTR_RELAY_URL: 'wss://relay.damus.io',
        KIND_ORDER_INTENT: 1004,
    };

    // --- State Management ---
    const state = {
        connected: false,
        address: null,
        publicKey: null,
        balances: {},
        orderBook: [],
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
    
    // --- The Definitive Wallet Detector ---
    const getWizzWallet = () => {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 20; // Wait up to 4 seconds, which is a long time
            
            const interval = setInterval(() => {
                // We ONLY look for the unique `window.wizz` object.
                if (window.wizz && window.wizz.isInstalled) {
                    clearInterval(interval);
                    resolve(window.wizz);
                } else {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        clearInterval(interval);
                        const errorMessage = "Wizz Wallet not detected. The most common cause is a conflict with other wallet extensions (like MetaMask or Yours Wallet) that load first. The most reliable solution is to temporarily disable other wallets and refresh the page.";
                        reject(new Error(errorMessage));
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
            
            updateWalletUI(); // This function is now defined below
            showNotification('Signet Wallet Connected!', 'success');
            // connectNostr(); // Re-enable when ready

        } catch (error) {
            console.error(error);
            showNotification(error.message, 'error', 12000); // Show error for longer
        }
    };
    
    // Moved full function definitions here to avoid declaration errors
    function updateWalletUI() {
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
        updateBalancesUI();
    };

    function updateBalancesUI() {
        const fromToken = fromTokenSelect.value;
        const toToken = toTokenSelect.value;
        fromBalanceDiv.textContent = `Balance: ${state.balances[fromToken] || 0}`;
        toBalanceDiv.textContent = `Balance: ${state.balances[toToken] || 0}`;
    };

    // --- Initialization ---
    const init = () => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/nostr-tools/lib/nostr.bundle.js';
        script.onload = () => console.log("Nostr Tools loaded.");
        document.body.appendChild(script);

        const signetTokens = ['SAT', 'TEST', 'ATOM', 'BTC'];
        signetTokens.forEach(ticker => {
            fromTokenSelect.add(new Option(ticker, ticker));
            toTokenSelect.add(new Option(ticker, ticker));
        });
        if(fromTokenSelect.options.length > 1) {
            fromTokenSelect.value = 'SAT';
            toTokenSelect.value = 'TEST';
        }
        
        connectWalletBtn.addEventListener('click', handleConnectWallet);
        cancelSwapBtn.addEventListener('click', () => confirmationModal.classList.add('hidden'));
    };

    init();
});