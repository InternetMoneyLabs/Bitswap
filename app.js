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

    // --- The Definitive Wallet Connection Logic ---
    async function handleWalletSelection(event) {
        const button = event.currentTarget;
        const walletType = button.dataset.wallet;

        // Provide immediate feedback
        button.disabled = true;
        const originalText = button.querySelector('span').textContent;
        button.querySelector('span').textContent = 'Connecting...';

        if (walletType === 'wizz') {
            try {
                // THE CRITICAL CHANGE: We no longer check if `window.wizz` exists first.
                // We directly attempt the connection. This avoids all race conditions.
                
                // This line will throw a TypeError if `window.wizz` is undefined.
                const wizz = window.wizz;

                if (!wizz || !wizz.isInstalled) {
                    // This case is for obscure situations where the object might exist but isn't ready.
                    throw new Error("Wizz Wallet not found.");
                }

                // If we get past the line above, the wallet object exists. Now we can use it.
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
                // This catch block now handles ALL failures gracefully within our UI.
                console.error("Connection error:", error);

                if (error instanceof TypeError || error.message.includes("not found")) {
                    // This means window.wizz didn't exist. It's not installed.
                    // NO REDIRECT. We inform the user.
                    showNotification("Wizz Wallet not found. Please install the extension.", 'error');
                } else {
                    // This handles all other errors, like the user rejecting the connection
                    // or being on the wrong network.
                    showNotification(error.message, 'error');
                }
            } finally {
                // Always restore the button after the attempt.
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