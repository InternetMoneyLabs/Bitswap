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
    };

    // --- DOM Elements ---
    const connectWalletBtn = document.getElementById('connect-wallet-btn');
    const walletInfoDiv = document.getElementById('wallet-info');
    const walletAddressSpan = document.getElementById('wallet-address');
    const swapBtn = document.getElementById('swap-btn');
    const notificationToast = document.getElementById('notification-toast');
    
    // Modal Elements
    const walletModal = document.getElementById('wallet-modal');
    const connectWizzBtn = document.getElementById('connect-wizz');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // Token Selectors
    const fromTokenSelect = document.getElementById('from-token-select');
    const toTokenSelect = document.getElementById('to-token-select');


    // --- UI & Helper Functions ---
    const showNotification = (message, type = 'info', duration = 5000) => {
        notificationToast.textContent = message;
        notificationToast.className = `show ${type}`;
        setTimeout(() => notificationToast.className = 'hidden', duration);
    };

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

    // --- The New, On-Demand Wallet Connection Logic ---
    async function connectWizzWallet() {
        // Step 1: Check for the wallet *at the moment the user clicks*.
        if (!window.wizz || !window.wizz.isInstalled) {
            showNotification("Wizz Wallet not found. Please install the extension.", 'error');
            window.open('https://wizz.cash/', '_blank'); // Open install page for convenience
            return;
        }

        const wizz = window.wizz;

        try {
            // Step 2: Request network and accounts.
            const networkState = await wizz.getNetwork();
            if (networkState.network.toLowerCase() !== config.NETWORK) {
                showNotification(`Please switch Wizz Wallet to the ${config.NETWORK} network.`, 'error');
                return;
            }

            const accounts = await wizz.requestAccounts();
            state.connected = true;
            state.address = accounts[0];
            state.balances = await wizz.getBalances();
            state.publicKey = await wizz.getPublicKey();
            
            // Step 3: Update UI and close modal on success.
            updateWalletUI();
            walletModal.classList.add('hidden');
            showNotification('Signet Wallet Connected!', 'success');

        } catch (error) {
            // This catches if the user rejects the connection.
            console.error("Wizz connection error:", error);
            showNotification("Connection was rejected.", 'error');
        }
    }
    
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
        
        // --- Event Listeners ---
        
        // Main button opens the wallet selection modal
        connectWalletBtn.addEventListener('click', () => {
            walletModal.classList.remove('hidden');
        });

        // Close button in the modal
        closeModalBtn.addEventListener('click', () => {
            walletModal.classList.add('hidden');
        });
        
        // The specific button for Wizz Wallet inside the modal
        connectWizzBtn.addEventListener('click', connectWizzWallet);
    };

    init();
});