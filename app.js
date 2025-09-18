// --- Application Main ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- New: Configuration for Signet ---
    const config = {
        NETWORK: 'signet',
        NOSTR_RELAY_URL: 'wss://relay.damus.io',
        KIND_HTLC_INTENT: 1002,
        MEMPOOL_URL: 'https://mempool.space/signet',
        // Note: A public, Signet-compatible token API is needed for live token lists.
        // We will use a fallback list for this version.
    };

    // --- STATE MANAGEMENT ---
    const state = {
        connected: false,
        address: null,
        publicKey: null,
        balances: {},
        orderBook: [],
        nostrSub: null,
        wizzWallet: null, // To hold the detected wallet object
    };

    // --- DOM ELEMENTS (remain the same) ---
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

    let relay = null;

    // --- UI UPDATE FUNCTIONS ---
    // ... (No changes to UI functions like updateWalletUI, updateBalancesUI, renderOrderBook) ...
    const updateWalletUI = () => { /* ... (no changes) ... */ };
    const updateBalancesUI = () => { /* ... (no changes) ... */ };
    const showNotification = (message, type = 'info', duration = 5000) => {
        notificationToast.textContent = message;
        notificationToast.className = `show ${type}`;
        setTimeout(() => {
            notificationToast.className = 'hidden';
        }, duration);
    };
    const renderOrderBook = () => { /* ... (no changes) ... */ };

    // --- REVOLUTIONARY AVM LOGIC ---
    const AVMGenerator = { /* ... (no changes from previous advanced version) ... */ };

    // --- New: Robust Wallet Detection ---
    /**
     * Waits for the Wizz Wallet to be injected into the window object.
     * This prevents race conditions with other wallet extensions.
     * @returns {Promise<object>} A promise that resolves with the wizz object.
     */
    const getWizzWallet = () => {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 10; // Try for 2 seconds (10 * 200ms)
            const interval = setInterval(() => {
                if (window.wizz && window.wizz.isInstalled) {
                    clearInterval(interval);
                    resolve(window.wizz);
                } else {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        clearInterval(interval);
                        reject(new Error("Wizz Wallet not found after 2 seconds."));
                    }
                }
            }, 200);
        });
    };
    
    // --- WEB3 & P2P LOGIC ---

    const connectNostr = () => { /* ... (no changes) ... */ };
    const subscribeToOrders = () => { /* ... (no changes) ... */ };

    const handleConnectWallet = async () => {
        try {
            const wizz = await getWizzWallet();
            state.wizzWallet = wizz;
            
            showNotification(`Requesting connection to ${config.NETWORK}...`, 'info');
            
            // New: Request accounts specifically for the Signet network
            const accounts = await state.wizzWallet.requestAccounts({ network: config.NETWORK });
            
            state.connected = true;
            state.address = accounts[0];
            state.balances = await state.wizzWallet.getBalances();
            state.publicKey = await state.wizzWallet.getPublicKey();
            
            updateWalletUI();
            connectNostr();
            showNotification('Signet Wallet Connected!', 'success');

        } catch (error) {
            console.error(error);
            showNotification('Connection Error: Ensure Wizz Wallet is unlocked and enabled. Try disabling other wallet extensions (like MetaMask) and refresh.', 'error', 10000);
        }
    };

    const handleCreateOrder = async () => {
        // ... (Logic for creating an order is the same, but now it will use the signet-connected wallet) ...
        const fromAmount = parseFloat(fromAmountInput.value);
        // ... (rest of the function is identical to previous version)
        if (fromAmount > (state.balances[fromToken] || 0)) {
            showNotification('Insufficient balance on Signet.', 'error');
            return;
        }

        try {
            // ... (The rest of the logic remains the same)
            const signedEvent = await state.wizzWallet.signNostrEvent(event);
            // ...
        } catch (error) {
            showNotification('Signet transaction failed or was rejected.', 'error');
        }
    };

    const handleTakeOrder = async (event) => { /* ... (no changes) ... */ };

    // --- INITIALIZATION ---
    const init = () => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/nostr-tools/lib/nostr.bundle.js';
        script.onload = () => {
            connectWalletBtn.addEventListener('click', handleConnectWallet);
            swapBtn.addEventListener('click', handleCreateOrder);
            // Add other event listeners here...
        };
        document.body.appendChild(script);
        
        // Use a fallback token list since Signet APIs are not readily available
        const fallbackTokens = ['ATOM', 'PEPE', 'ORDI', 'SATS'];
        fallbackTokens.forEach(ticker => {
            fromTokenSelect.add(new Option(ticker, ticker));
            toTokenSelect.add(new Option(ticker, ticker));
        });
        if (fromTokenSelect.options.length > 1) {
            fromTokenSelect.value = 'ATOM';
            toTokenSelect.value = 'PEPE';
        }
    };

    init();

    // Re-pasting unchanged functions for completeness
    function updateWalletUI() {
        if (state.connected) {
            connectWalletBtn.classList.add('hidden');
            walletInfoDiv.classList.remove('hidden');
            const addr = state.address;
            walletAddressSpan.textContent = `Signet: ${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
            swapBtn.textContent = 'Create Escrow';
            swapBtn.disabled = false;
        } else { /* ... */ }
        updateBalancesUI();
    }
    function updateBalancesUI() {
        const fromToken = fromTokenSelect.value;
        const toToken = toTokenSelect.value;
        fromBalanceDiv.textContent = `Balance: ${state.balances[fromToken] || 0}`;
        toBalanceDiv.textContent = `Balance: ${state.balances[toToken] || 0}`;
    }
    function renderOrderBook() {
        if (!state.connected) {
            orderBookDiv.innerHTML = '<p>Connect wallet to view live escrowed orders.</p>'; return;
        }
        orderBookDiv.innerHTML = state.orderBook.length === 0 
            ? '<p>No live swap contracts found. Be the first to create one!</p>'
            : state.orderBook.map(order => `
                <div class="order" data-id="${order.id}">
                    <span>Selling: <strong>${order.content.fromAmount} ${order.content.fromToken}</strong></span>
                    <span class="rate">Wants: <strong>${order.content.toAmount} ${order.content.toToken}</strong></span>
                    <button class="take-order-btn" data-id="${order.id}">Initiate Swap</button>
                </div>
            `).join('');
        
        document.querySelectorAll('.take-order-btn').forEach(button => {
            button.addEventListener('click', handleTakeOrder);
        });
    }
    const AVMGenerator = {
        createInitiatorLockProgram: (initiatorPubkey, commitmentHash, fromToken, fromAmount, toToken, toAmount, refundBlockHeight) => {
            const swapDetails = { fromToken, fromAmount, toToken, toAmount, refundBlockHeight };
            return [
                { "PushStr": { "PushStr": commitmentHash } }, { "PushStr": { "PushStr": JSON.stringify(swapDetails) } },
                { "StrToBytes": { "StrToBytes": null } }, { "KvPutBytes": { "KvPutBytes": null } },
                { "PushStr": { "PushStr": `lock_${commitmentHash}` } }, { "Push": { "Push": fromAmount } },
                { "BalanceAdd": { "BalanceAdd": null } }, { "Return": { "Return": null } }
            ];
        },
        createTakerClaimProgram: (preimage, commitmentHash) => {
            return [
                { "PushStr": { "PushStr": preimage } }, { "Sha256Hash": { "Sha256Hash": null } },
                { "PushStr": { "PushStr": commitmentHash } }, { "StrToBytes": { "StrToBytes": null } },
                { "EqualVerify": { "EqualVerify": null } }, { "PushStr": { "PushStr": "Claim Successful" } },
                { "Return": { "Return": null } }
            ];
        }
    };
    function connectNostr() {
        try {
            relay = NostrTools.relayInit(config.NOSTR_RELAY_URL);
            relay.on('connect', () => { console.log(`Connected to ${relay.url}`); subscribeToOrders(); });
            relay.on('error', () => showNotification('Error connecting to P2P network.', 'error'));
            relay.connect();
        } catch (e) { console.error("Nostr connection failed:", e); }
    }
    function subscribeToOrders() {
        if (!relay || relay.status !== 1) return;
        state.nostrSub = relay.sub([{ kinds: [config.KIND_HTLC_INTENT] }]);
        state.nostrSub.on('event', event => {
            try {
                const content = JSON.parse(event.content);
                if (content.commitmentHash && content.fromToken && content.fromAmount) {
                    if (!state.orderBook.some(o => o.id === event.id)) {
                        state.orderBook.unshift({ id: event.id, pubkey: event.pubkey, content });
                        if (state.orderBook.length > 100) state.orderBook.pop();
                        renderOrderBook();
                    }
                }
            } catch (e) { /* ignore */ }
        });
    }
});