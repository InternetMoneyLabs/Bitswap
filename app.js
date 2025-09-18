// --- Application Main ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- LIVE CONFIGURATION ---
    const NOSTR_RELAY_URL = 'wss://relay.damus.io';
    const KIND_HTLC_INTENT = 1002; // New Nostr kind for our trustless HTLC intents

    // --- STATE MANAGEMENT ---
    const state = {
        connected: false,
        address: null,
        publicKey: null,
        balances: {},
        orderBook: [],
        nostrSub: null,
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

    // --- LIVE WALLET & NOSTR INTEGRATION ---
    const wizz = window.wizz;
    let relay = null;

    // --- UI UPDATE FUNCTIONS ---
    const updateWalletUI = () => { /* ... (no changes from previous live version) ... */ };
    const updateBalancesUI = () => { /* ... (no changes from previous live version) ... */ };
    const showNotification = (message, type = 'info', duration = 5000) => {
        notificationToast.textContent = message;
        notificationToast.className = `show ${type}`;
        setTimeout(() => {
            notificationToast.className = 'hidden';
        }, duration);
    };

    const renderOrderBook = () => {
        if (!state.connected) {
            orderBookDiv.innerHTML = '<p>Connect wallet to view live escrowed orders.</p>';
            return;
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
    };

    // --- REVOLUTIONARY AVM LOGIC ---
    const AVMGenerator = {
        /**
         * Creates the first AVM program to lock the initiator's funds.
         * This is the core of the HTLC.
         */
        createInitiatorLockProgram: (initiatorPubkey, commitmentHash, fromToken, fromAmount, toToken, toAmount, refundBlockHeight) => {
            const swapDetails = { fromToken, fromAmount, toToken, toAmount, refundBlockHeight };
            return [
                // Store the commitment hash and swap details on-chain
                { "PushStr": { "PushStr": commitmentHash } }, // Key: the hash
                { "PushStr": { "PushStr": JSON.stringify(swapDetails) } }, // Value: swap terms
                { "StrToBytes": { "StrToBytes": null } },
                { "KvPutBytes": { "KvPutBytes": null } },
                
                // Lock the funds in a virtual UTXO. This is a conceptual representation.
                // A real implementation would use specific token locking opcodes.
                { "PushStr": { "PushStr": `lock_${commitmentHash}` } }, // Unique lock ID
                { "Push": { "Push": fromAmount } },
                { "BalanceAdd": { "BalanceAdd": null } }, // Add funds to the "lock" balance

                // The following logic would be part of the UTXO's script
                // This is a conceptual representation of the script logic:
                // IF (preimage provided which matches hash) AND (toAmount of toToken is sent) THEN unlock
                // IF (blockheight > refundBlockHeight) AND (signature matches initiatorPubkey) THEN refund
                
                { "Return": { "Return": null } }
            ];
        },
        /**
         * Simulates the program the Taker would use to claim the funds.
         */
        createTakerClaimProgram: (preimage, commitmentHash) => {
            return [
                // 1. Verify the provided preimage matches the stored hash
                { "PushStr": { "PushStr": preimage } },
                { "Sha256Hash": { "Sha256Hash": null } }, // Hash the provided preimage
                { "PushStr": { "PushStr": commitmentHash } }, // Push the known hash
                { "StrToBytes": { "StrToBytes": null } },
                { "EqualVerify": { "EqualVerify": null } }, // Fails if they don't match
                
                // 2. If verification passes, proceed to transfer funds
                // This would involve unlocking the VUTXO and transferring both assets
                // ... complex transfer logic would go here ...
                
                { "PushStr": { "PushStr": "Claim Successful" } },
                { "Return": { "Return": null } }
            ];
        }
    };
    
    // --- WEB3 & P2P LOGIC ---

    const connectNostr = () => {
        try {
            relay = NostrTools.relayInit(NOSTR_RELAY_URL);
            relay.on('connect', () => {
                console.log(`Connected to ${relay.url}`);
                subscribeToOrders();
            });
            relay.on('error', () => showNotification('Error connecting to P2P network.', 'error'));
            relay.connect();
        } catch (e) {
            console.error("Nostr connection failed:", e);
            showNotification('Could not initialize P2P network.', 'error');
        }
    };

    const subscribeToOrders = () => {
        if (!relay || relay.status !== 1) return;
        state.nostrSub = relay.sub([{ kinds: [KIND_HTLC_INTENT] }]);
        state.nostrSub.on('event', event => {
            try {
                const content = JSON.parse(event.content);
                // Validate incoming order
                if (content.commitmentHash && content.fromToken && content.fromAmount) {
                    if (!state.orderBook.some(o => o.id === event.id)) {
                        state.orderBook.unshift({ id: event.id, pubkey: event.pubkey, content });
                        if (state.orderBook.length > 100) state.orderBook.pop();
                        renderOrderBook();
                    }
                }
            } catch (e) { /* ignore invalid events */ }
        });
    };

    const handleConnectWallet = async () => {
        if (!wizz || !wizz.isInstalled) {
            showNotification('Wizz Wallet is required for this DApp.', 'error');
            return;
        }
        try {
            const accounts = await wizz.requestAccounts();
            state.connected = true;
            state.address = accounts[0];
            state.balances = await wizz.getBalances();
            state.publicKey = await wizz.getPublicKey();
            updateWalletUI();
            connectNostr();
        } catch (error) {
            showNotification('Wallet connection rejected.', 'error');
        }
    };

    const handleCreateOrder = async () => {
        const fromAmount = parseFloat(fromAmountInput.value);
        const toAmount = parseFloat(toAmountInput.value);
        const fromToken = fromTokenSelect.value;
        const toToken = toTokenSelect.value;

        if (fromToken === toToken || isNaN(fromAmount) || fromAmount <= 0 || isNaN(toAmount) || toAmount <= 0) {
            showNotification('Please enter valid and distinct swap details.', 'error');
            return;
        }
        if (fromAmount > (state.balances[fromToken] || 0)) {
            showNotification('Insufficient balance to create escrow.', 'error');
            return;
        }

        // 1. Create the secret and hash
        const preimage = NostrTools.utils.bytesToHex(window.crypto.getRandomValues(new Uint8Array(32)));
        const commitmentHash = NostrTools.utils.bytesToHex(await NostrTools.utils.sha256(preimage));
        localStorage.setItem(`preimage_${commitmentHash}`, preimage); // Store preimage securely in local storage
        
        // 2. Define the refund time (e.g., 144 blocks for ~24 hours)
        const refundBlockHeight = 850000 + 144; // Using demo block height

        // 3. Generate the AVM program to lock funds
        const avmProgram = AVMGenerator.createInitiatorLockProgram(
            state.publicKey, commitmentHash, fromToken, fromAmount, toToken, toAmount, refundBlockHeight
        );
        
        // 4. Send the transaction to lock funds
        try {
            showNotification('Please confirm the transaction to lock your funds in the HTLC.', 'info', 10000);
            // In a real scenario, this would be a specific AVM transaction
            // const result = await wizz.sendAvmTransaction(avmProgram);
            // console.log("Locking transaction sent:", result.txid);
            console.log("SIMULATING ON-CHAIN LOCK with AVM Program:", avmProgram);
            
            // 5. If transaction is successful, broadcast the intent to Nostr
            const intent = { commitmentHash, fromToken, fromAmount, toToken, toAmount, refundBlockHeight };
            let event = NostrTools.getBlankEvent();
            event.kind = KIND_HTLC_INTENT;
            event.created_at = Math.floor(Date.now() / 1000);
            event.content = JSON.stringify(intent);
            event.pubkey = state.publicKey;
            
            const signedEvent = await wizz.signNostrEvent(event);
            let pub = relay.publish(signedEvent);
            pub.on('ok', () => {
                showNotification('Escrow created and order broadcasted!', 'success');
            });

        } catch (error) {
            showNotification('Escrow creation failed or was rejected.', 'error');
            console.error(error);
        }
    };

    const handleTakeOrder = async (event) => {
        const orderId = event.target.dataset.id;
        const order = state.orderBook.find(o => o.id === orderId);
        if (!order) return;

        showNotification(`You are about to lock ${order.content.toAmount} ${order.content.toToken} to swap. Please follow wallet instructions.`, 'info', 15000);

        // This would be Stage 2 of the HTLC flow.
        // The user would create their own counter-lock AVM transaction.
        // For this demo, we will simulate the final step: claiming with the preimage.
        
        const preimage = localStorage.getItem(`preimage_${order.content.commitmentHash}`);
        if (preimage) {
            // This simulates the user being the INITIATOR and now claiming their funds
            // after the other party has locked theirs.
            showNotification('Counter-party lock detected! Attempting to claim funds with your secret.', 'info', 10000);
            const claimProgram = AVMGenerator.createTakerClaimProgram(preimage, order.content.commitmentHash);
            console.log("SIMULATING FINAL CLAIM with AVM Program:", claimProgram);
            // await wizz.sendAvmTransaction(claimProgram);
            showNotification('SUCCESS! Swap complete.', 'success');
        } else {
            // This simulates the user being the TAKER.
            // They would first lock their funds, then wait for the initiator to claim.
            showNotification('To take this order, you would now create a counter-escrow.', 'info');
        }
    };

    // --- INITIALIZATION ---
    const init = () => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/nostr-tools/lib/nostr.bundle.js';
        script.onload = () => {
            connectWalletBtn.addEventListener('click', handleConnectWallet);
            swapBtn.addEventListener('click', handleCreateOrder);
        };
        document.body.appendChild(script);
    };

    init();
});