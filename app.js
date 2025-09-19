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

    // --- Corrected, On-Demand Wallet Connection Logic ---
    async function handleWalletSelection(event) {
        const walletType = event.currentTarget.dataset.wallet;

        if (walletType === 'wizz') {
            // Give the browser a moment to respond to the click before checking for the wallet
            await new Promise(resolve => setTimeout(resolve, 100));

            if (!window.wizz || !window.wizz.isInstalled) {
                showNotification("Wizz Wallet not found. Please install the extension.", 'error');
                // Only redirect if we are sure it's not there
                window.open('https://wizz.cash/', '_blank');
                return;
            }

            const wizz = window.wizz;
            try {
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
                console.error("Wizz connection error:", error);
                showNotification("Connection was rejected.", 'error');
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
        
        // Attach the event listener to all buttons with the `data-wallet` attribute
        document.querySelectorAll('.wallet-option[data-wallet]').forEach(button => {
            button.addEventListener('click', handleWalletSelection);
        });
    };

    init();
});