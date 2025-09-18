// --- Application Main ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Signet Configuration ---
    const config = {
        NETWORK: 'signet',
        NOSTR_RELAY_URL: 'wss://relay.damus.io',
        KIND_ORDER_SLOT: 1003, // New Nostr kind for our on-chain order slots
        // Curated Signet ARC-20 Tokens (as a public API is unavailable)
        SIGNET_TOKENS: {
            'SAT': { id: 'sat_signet_id' },
            'TEST': { id: 'test_signet_id' }
        },
    };

    // --- State Management ---
    const state = {
        connected: false,
        address: null,
        publicKey: null,
        balances: {},
        orderBook: [], // Will store on-chain order data
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
    // New: Modal for network switching instructions
    const confirmationModal = document.getElementById('confirmation-modal');
    const swapSummaryDiv = document.getElementById('swap-summary');
    const confirmSwapBtn = document.getElementById('confirm-swap-btn');
    const cancelSwapBtn = document.getElementById('cancel-swap-btn');


    let relay = null;

    // --- UI Update Functions ---
    const showNotification = (message, type = 'info', duration = 5000) => {
        notificationToast.textContent = message;
        notificationToast.className = `show ${type}`;
        setTimeout(() => notificationToast.className = 'hidden', duration);
    };

    const showNetworkSwitchModal = () => {
        swapSummaryDiv.innerHTML = `
            <p><strong>Incorrect Network</strong></p>
            <p>Your Wizz Wallet is connected to Mainnet. Please switch to the <strong>Signet</strong> network to use BitSwap.</p>
            <ol>
                <li>Open Wizz Wallet extension.</li>
                <li>Go to Settings (gear icon).</li>
                <li>Select "Network".</li>
                <li>Choose "Signet".</li>
                <li>Refresh this page.</li>
            </ol>
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
            swapBtn.textContent = 'Create On-Chain Order';
            swapBtn.disabled = false;
        } else {
            connectWalletBtn.classList.remove('hidden');
            walletInfoDiv.classList.add('hidden');
            swapBtn.textContent = 'Connect Wallet';
            swapBtn.disabled = true;
        }
        updateBalancesUI();
    };

    const updateBalancesUI = () => {
        const fromToken = fromTokenSelect.value;
        const toToken = toTokenSelect.value;
        fromBalanceDiv.textContent = `Balance: ${state.balances[fromToken] || 0}`;
        toBalanceDiv.textContent = `Balance: ${state.balances[toToken] || 0}`;
    };

    const renderOrderBook = () => {
        // ... (UI rendering logic remains similar)
    };

    // --- Advanced AVM Program Generator ---
    const AVMGenerator = {
        /**
         * Creates an AVM program to establish a stateful, on-chain order slot.
         */
        createOrderSlotProgram: (orderId, ownerPubkey, fromToken, fromAmount, toToken, toAmount) => {
            const price = toAmount / fromAmount; // Price: how much 'toToken' per one 'fromToken'
            return [
                // Store Order Metadata
                { "PushStr": { "PushStr": `order:${orderId}:owner` } },
                { "PushStr": { "PushStr": ownerPubkey } },
                { "StrToBytes": { "StrToBytes": null } },
                { "KvPutBytes": { "KvPutBytes": null } },

                { "PushStr": { "PushStr": `order:${orderId}:fromToken` } },
                { "PushStr": { "PushStr": fromToken } },
                { "StrToBytes": { "StrToBytes": null } },
                { "KvPutBytes": { "KvPutBytes": null } },

                { "PushStr": { "PushStr": `order:${orderId}:toToken` } },
                { "PushStr": { "PushStr": toToken } },
                { "StrToBytes": { "StrToBytes": null } },
                { "KvPutBytes": { "KvPutBytes": null } },

                // Store dynamic state: remaining amount and price
                { "PushStr": { "PushStr": `order:${orderId}:remaining` } },
                { "Push": { "Push": fromAmount } },
                { "NumToBig": { "NumToBig": null } },
                { "BigToBytes": { "BigToBytes": null } },
                { "KvPutBytes": { "KvPutBytes": null } },
                
                { "PushStr": { "PushStr": `order:${orderId}:price` } },
                { "Push": { "Push": price * 1e8 } }, // Store price as integer
                { "NumToBig": { "NumToBig": null } },
                { "BigToBytes": { "BigToBytes": null } },
                { "KvPutBytes": { "KvPutBytes": null } },

                // Lock the actual funds into a virtual UTXO tied to this order
                { "PushStr": { "PushStr": fromToken } },
                { "Push": { "Push": fromAmount } },
                { "Lock": { "Lock": null } }, // Conceptual lock for the specified token
                
                { "Return": { "Return": null } }
            ];
        },
    };

    // --- Robust Wallet Detection & Connection ---
    const getWizzWallet = () => {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 10; // Try for 2 seconds
            const interval = setInterval(() => {
                if (window.wizz && window.wizz.isInstalled) {
                    clearInterval(interval);
                    resolve(window.wizz);
                } else {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        clearInterval(interval);
                        reject(new Error("Wizz Wallet not found. Please ensure it's installed and enabled."));
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

            if (networkState.network !== config.NETWORK) {
                showNetworkSwitchModal();
                return;
            }

            const accounts = await state.wizzWallet.requestAccounts();
            state.connected = true;
            state.address = accounts[0];
            state.balances = await state.wizzWallet.getBalances();
            state.publicKey = await state.wizzWallet.getPublicKey();
            
            updateWalletUI();
            // connectNostr(); // Connect to P2P network after successful connection
            showNotification('Signet Wallet Connected!', 'success');

        } catch (error) {
            console.error(error);
            showNotification(error.message, 'error', 8000);
        }
    };
    
    // --- Core Logic Handlers ---
    const handleCreateOrder = async () => {
        // ... Logic to get amounts and tokens from UI ...
        const fromAmount = 100; // Example
        const toAmount = 5000;  // Example
        const fromToken = 'SAT';
        const toToken = 'TEST';

        if (fromAmount > (state.balances[fromToken] || 0)) {
            showNotification('Insufficient balance to create order.', 'error');
            return;
        }

        const orderId = NostrTools.utils.bytesToHex(window.crypto.getRandomValues(new Uint8Array(16)));
        
        const avmProgram = AVMGenerator.createOrderSlotProgram(
            orderId, state.publicKey, fromToken, fromAmount, toToken, toAmount
        );

        try {
            showNotification('Confirm transaction to create your on-chain order.', 'info');
            console.log("SIMULATING CREATION of ON-CHAIN ORDER SLOT with AVM Program:", avmProgram);
            // const result = await state.wizzWallet.sendAvmTransaction(avmProgram);
            // showNotification(`On-chain order created! TXID: ${result.txid}`, 'success');
            // Then broadcast orderId to Nostr...
        } catch (e) {
            showNotification('Transaction was rejected or failed.', 'error');
        }
    };

    // --- Initialization ---
    const init = () => {
        // Load NostrTools script dynamically
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/nostr-tools/lib/nostr.bundle.js';
        script.onload = () => {
            console.log("Nostr Tools loaded.");
        };
        document.body.appendChild(script);

        // Populate token selectors with our curated Signet list
        Object.keys(config.SIGNET_TOKENS).forEach(ticker => {
            fromTokenSelect.add(new Option(ticker, ticker));
            toTokenSelect.add(new Option(ticker, ticker));
        });
        if(fromTokenSelect.options.length > 1) {
            fromTokenSelect.value = 'SAT';
            toTokenSelect.value = 'TEST';
        }
        
        // Setup Event Listeners
        connectWalletBtn.addEventListener('click', handleConnectWallet);
        swapBtn.addEventListener('click', handleCreateOrder);
        cancelSwapBtn.addEventListener('click', () => confirmationModal.classList.add('hidden'));
    };

    init();
});