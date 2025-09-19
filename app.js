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

    // --- Definitive Wallet Connection Logic ---
    async function handleWalletSelection(event) {
        const walletType = event.currentTarget.dataset.wallet;

        if (walletType === 'wizz') {
            // We assume the wallet might exist and try to use it directly.
            // The error handling will catch cases where it's not installed.
            try {
                // This is the crucial line. If `window.wizz` doesn't exist, this will throw a TypeError.
                const wizz = window.wizz;
                
                // If it exists, proceed with the connection.
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
                
                updateWalletUI();
                walletModal.classList.add('hidden');
                showNotification('Signet Wallet Connected!', 'success');

            } catch (error) {
                // This 'catch' block is now the ONLY place we check for installation.
                if (error instanceof TypeError) {
                    // This error means `window.wizz` was undefined, so the wallet is not installed.
                    showNotification("Wizz Wallet not found. Please install the extension.", 'error');
                    window.open('https://wizz.cash/', '_blank'); // Open install page for convenience
                } else {
                    // This handles other errors, like the user rejecting the connection.
                    console.error("Wizz connection error:", error);
                    showNotification("Connection was rejected or failed.", 'error');
                }
            }
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
        connectWalletBtn.addEventListener('click', () => {
            walletModal.classList.remove('hidden');
        });

        closeModalBtn.addEventListener('click', () => {
            walletModal.classList.add('hidden');
        });
        
        document.querySelectorAll('.wallet-option[data-wallet]').forEach(button => {
            button.addEventListener('click', handleWalletSelection);
        });
    };

    init();
});