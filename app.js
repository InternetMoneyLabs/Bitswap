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
        const button = event.currentTarget;
        const walletType = button.dataset.wallet;

        if (walletType === 'wizz') {
            // Step 1: Provide immediate user feedback to show the app is working.
            button.disabled = true;
            const originalText = button.querySelector('span').textContent;
            button.querySelector('span').textContent = 'Connecting...';

            // Step 2: THE CRITICAL FIX - Wait for the next "tick" of the browser's event loop.
            // This tiny delay gives the Wizz Wallet extension time to respond to the user's click.
            await new Promise(resolve => setTimeout(resolve, 50)); 

            try {
                // Step 3: Now, confidently check for the wallet.
                if (!window.wizz || !window.wizz.isInstalled) {
                    throw new Error("Wizz Wallet not found. Please install the extension.");
                }

                const wizz = window.wizz;
                
                const networkState = await wizz.getNetwork();
                if (networkState.network.toLowerCase() !== config.NETWORK) {
                    throw new Error(`Please switch Wizz Wallet to the ${config.NETWORK} network.`);
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
                // Step 4: Handle all errors gracefully.
                showNotification(error.message, 'error');
                if (error.message.includes("not found")) {
                    window.open('https://wizz.cash/', '_blank');
                }
                console.error("Wizz connection error:", error);
            } finally {
                // Step 5: Always restore the button to its original state.
                button.disabled = false;
                button.querySelector('span').textContent = originalText;
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