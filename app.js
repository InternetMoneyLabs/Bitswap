// --- Application Main ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- LIVE CONFIGURATION ---
    const NOSTR_RELAY_URL = 'wss://relay.damus.io'; // Using a popular public Nostr relay
    const TOKEN_API_URL = 'https://api.atomicalmarket.com/proxy/blockchain.atomicals.get_tokens?params={}&pretty'; // Public API for token list
    const KIND_SWAP_INTENT = 1001; // Custom Nostr kind for our swap intents

    // --- STATE MANAGEMENT ---
    const state = {
        connected: false,
        address: null,
        publicKey: null,
        balances: {},
        availableTokens: {}, // To be populated from API
        orderBook: [],
        nostrSub: null, // Holds the Nostr subscription object
        currentSwap: null,
    };

    // --- DOM ELEMENTS ---
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

    const confirmationModal = document.getElementById('confirmation-modal');
    const swapSummaryDiv = document.getElementById('swap-summary');
    const confirmSwapBtn = document.getElementById('confirm-swap-btn');
    const cancelSwapBtn = document.getElementById('cancel-swap-btn');
    
    const notificationToast = document.getElementById('notification-toast');

    // --- LIVE WALLET & NOSTR INTEGRATION ---
    const wizz = window.wizz; // Access the real Wizz Wallet extension
    let relay = null; // To be initialized on connect

    // --- UI UPDATE FUNCTIONS ---
    const updateWalletUI = () => {
        if (state.connected) {
            connectWalletBtn.classList.add('hidden');
            walletInfoDiv.classList.remove('hidden');
            const addr = state.address;
            walletAddressSpan.textContent = `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
            swapBtn.textContent = 'Create Swap Order';
            swapBtn.disabled = false;
        } else {
            connectWalletBtn.classList.remove('hidden');
            walletInfoDiv.classList.add('hidden');
            swapBtn.textContent = 'Connect Wallet to Swap';
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
    
    const populateTokenSelectors = () => {
        fromTokenSelect.innerHTML = '';
        toTokenSelect.innerHTML = '';
        for (const ticker in state.availableTokens) {
            const option1 = new Option(ticker, ticker);
            const option2 = new Option(ticker, ticker);
            fromTokenSelect.add(option1);
            toTokenSelect.add(option2);
        }
        // Set default different tokens
        if (fromTokenSelect.options.length > 1) {
            fromTokenSelect.value = 'ATOM';
            toTokenSelect.value = 'PEPE';
        }
        updateBalancesUI();
    };

    const renderOrderBook = () => {
        if (!state.connected) {
            orderBookDiv.innerHTML = '<p>Connect wallet to view live orders.</p>';
            return;
        }
        
        const fromToken = fromTokenSelect.value;
        const toToken = toTokenSelect.value;
        
        const relevantOrders = state.orderBook.filter(o => o.from === fromToken && o.to === toToken);
        
        if (relevantOrders.length === 0) {
            orderBookDiv.innerHTML = `<p>No live orders found for ${fromToken} → ${toToken}.</p>`;
            return;
        }

        orderBookDiv.innerHTML = relevantOrders.map(order => {
            const truncatedPubkey = `${order.pubkey.substring(0, 8)}...${order.pubkey.substring(order.pubkey.length - 4)}`;
            return `
                <div class="order" data-id="${order.id}">
                    <span>Selling: ${order.amount.toFixed(2)} ${order.from} (by ${truncatedPubkey})</span>
                    <span class="rate">Rate: ${order.price.toPrecision(4)} ${order.to}/${order.from}</span>
                    <button class="take-order-btn" data-id="${order.id}">Take</button>
                </div>
            `;
        }).join('');
        
        // Add event listeners to the new "Take" buttons
        document.querySelectorAll('.take-order-btn').forEach(button => {
            button.addEventListener('click', handleTakeOrder);
        });
    };

    const updateSwapAmounts = () => {
        const fromAmount = parseFloat(fromAmountInput.value);
        if (isNaN(fromAmount) || fromAmount <= 0) {
            toAmountInput.value = '';
            return;
        }
        const fromToken = fromTokenSelect.value;
        const toToken = toTokenSelect.value;
        
        // Use the best available price from the live order book
        const bestOrder = state.orderBook
            .filter(o => o.from === toToken && o.to === fromToken) // Look for inverse orders to get a price
            .sort((a, b) => a.price - b.price)[0];

        if (bestOrder) {
            const price = 1 / bestOrder.price;
            const toAmount = fromAmount * price;
            toAmountInput.value = toAmount.toPrecision(6);
        } else {
            toAmountInput.value = ''; // No price available
        }
    };
    
    const showNotification = (message, type = 'info') => {
        notificationToast.textContent = message;
        notificationToast.className = `show ${type}`;
        setTimeout(() => {
            notificationToast.className = 'hidden';
        }, 5000);
    };

    // --- AVM PROGRAM GENERATOR ---
    const AVMGenerator = {
        // This is a simplified atomic swap program. A robust implementation would use a
        // commit-reveal or hash-lock mechanism to ensure true atomicity without a trusted third party.
        createAtomicSwapProgram: (userAddress, counterpartyAddress, userSendsAmount, counterpartySendsAmount) => {
            return [
                // Transfer from user to counterparty
                {"Push":{"Push": userAddress}},
                {"Push":{"Push": counterpartyAddress}},
                {"Push":{"Push": userSendsAmount}},
                {"Transfer":{"Transfer":null}},
                // Transfer from counterparty to user
                {"Push":{"Push": counterpartyAddress}},
                {"Push":{"Push": userAddress}},
                {"Push":{"Push": counterpartySendsAmount}},
                {"Transfer":{"Transfer":null}},
                {"Return":{"Return":null}}
            ];
        }
    };

    // --- APPLICATION LOGIC ---

    const fetchTokens = async () => {
        try {
            const response = await fetch(TOKEN_API_URL);
            const data = await response.json();
            const tokenData = data.response.result.global.arc20_tickers;
            // Filter for some popular tokens for this demo
            const popularTokens = ['ATOM', 'PEPE', 'ORDI', 'SATS', 'BITMAP'];
            state.availableTokens = Object.fromEntries(
                Object.entries(tokenData).filter(([ticker]) => popularTokens.includes(ticker))
            );
            populateTokenSelectors();
        } catch (error) {
            console.error("Failed to fetch tokens:", error);
            showNotification('Could not load token list.', 'error');
            // Fallback to default tokens
            state.availableTokens = { ATOM: {}, PEPE: {}, ORDI: {} };
            populateTokenSelectors();
        }
    };

    const connectNostr = () => {
        try {
            relay = NostrTools.relayInit(NOSTR_RELAY_URL);
            relay.on('connect', () => {
                console.log(`Connected to ${relay.url}`);
                subscribeToOrders();
            });
            relay.on('error', () => {
                console.error(`Failed to connect to ${relay.url}`);
                showNotification('Error connecting to P2P network.', 'error');
            });
            relay.connect();
        } catch (e) {
            console.error("Nostr connection failed:", e);
            showNotification('Could not initialize P2P network.', 'error');
        }
    };

    const subscribeToOrders = () => {
        if (!relay || relay.status !== 1) return; // 1 = connected
        state.nostrSub = relay.sub([{ kinds: [KIND_SWAP_INTENT] }]);
        state.nostrSub.on('event', event => {
            try {
                const intent = JSON.parse(event.content);
                // Basic validation
                if (intent.from && intent.to && intent.amount && intent.price) {
                    const orderId = event.id;
                    // Avoid duplicates
                    if (!state.orderBook.some(o => o.id === orderId)) {
                        state.orderBook.unshift({
                            id: orderId,
                            pubkey: event.pubkey,
                            from: intent.from,
                            to: intent.to,
                            amount: parseFloat(intent.amount),
                            price: parseFloat(intent.price)
                        });
                         // Keep order book from growing indefinitely
                        if (state.orderBook.length > 100) {
                            state.orderBook.pop();
                        }
                        renderOrderBook();
                    }
                }
            } catch (e) {
                // Ignore invalid event content
            }
        });
    };

    const handleConnectWallet = async () => {
        if (!wizz || !wizz.isInstalled) {
            showNotification('Wizz Wallet not found. Please install the extension.', 'error');
            window.open('https://wizz.cash/', '_blank');
            return;
        }
        try {
            const accounts = await wizz.requestAccounts();
            if (accounts && accounts.length > 0) {
                state.connected = true;
                state.address = accounts[0];
                const balances = await wizz.getBalances();
                state.balances = balances;
                state.publicKey = await wizz.getPublicKey();
                updateWalletUI();
                connectNostr(); // Connect to P2P network after wallet is connected
            }
        } catch (error) {
            showNotification('Wallet connection was rejected.', 'error');
            console.error(error);
        }
    };
    
    const handleCreateOrder = async () => {
        const fromAmount = parseFloat(fromAmountInput.value);
        const toAmount = parseFloat(toAmountInput.value);
        const fromToken = fromTokenSelect.value;
        const toToken = toTokenSelect.value;

        if (fromToken === toToken) {
            showNotification('Cannot swap the same token.', 'error');
            return;
        }
        if (isNaN(fromAmount) || isNaN(toAmount) || fromAmount <= 0 || toAmount <= 0) {
            showNotification('Please enter valid amounts.', 'error');
            return;
        }
        if (fromAmount > (state.balances[fromToken] || 0)) {
            showNotification('Insufficient balance to create this order.', 'error');
            return;
        }

        const price = toAmount / fromAmount;

        const intent = {
            from: fromToken,
            to: toToken,
            amount: fromAmount,
            price: price,
        };

        try {
            // Create a Nostr event
            let event = NostrTools.getBlankEvent();
            event.kind = KIND_SWAP_INTENT;
            event.created_at = Math.floor(Date.now() / 1000);
            event.tags = [];
            event.content = JSON.stringify(intent);
            event.pubkey = state.publicKey;

            // Request signature from Wizz Wallet
            const signedEvent = await wizz.signNostrEvent(event);
            
            // Publish to the relay
            let pub = relay.publish(signedEvent);
            pub.on('ok', () => {
                showNotification('Swap order created and broadcasted!', 'success');
                fromAmountInput.value = '';
                toAmountInput.value = '';
            });
            pub.on('failed', (reason) => {
                showNotification(`Failed to publish order: ${reason}`, 'error');
            });

        } catch (error) {
            showNotification('Order creation failed or was rejected.', 'error');
            console.error(error);
        }
    };
    
    const handleTakeOrder = async (event) => {
        const orderId = event.target.dataset.id;
        const order = state.orderBook.find(o => o.id === orderId);
        if (!order) return;

        // The amount the user needs to send to take this order
        const amountToSend = order.amount * order.price;

        // Check if user has sufficient balance
        if (amountToSend > (state.balances[order.to] || 0)) {
            showNotification(`Insufficient ${order.to} balance to take this order.`, 'error');
            return;
        }
        
        // This is a simplified settlement for demo purposes.
        // A real DApp would require a more complex, trustless settlement mechanism.
        showNotification('Taking order... Please confirm the transaction in your wallet.', 'info');
        
        try {
             // In a real scenario, an AVM program would be constructed and sent.
             // wizz.sendArc20Transaction(...)
            
            // For now, we simulate the action and provide a success message.
            console.log("Simulating taking order:", order);
            showNotification(`Simulated settlement for order ${order.id.substring(0,8)}...`, 'success');

        } catch(e) {
            showNotification('Failed to process order.', 'error');
            console.error(e);
        }
    };
    
    // --- INITIALIZATION ---
    const init = () => {
        // Load NostrTools dynamically
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/nostr-tools/lib/nostr.bundle.js';
        script.onload = () => {
            console.log("Nostr Tools loaded.");
            connectWalletBtn.addEventListener('click', handleConnectWallet);
            swapBtn.addEventListener('click', handleCreateOrder);
            // We can't handle "take order" here because buttons are dynamic
        };
        document.body.appendChild(script);

        fromAmountInput.addEventListener('input', updateSwapAmounts);
        fromTokenSelect.addEventListener('change', () => {
            updateBalancesUI();
            renderOrderBook();
            updateSwapAmounts();
        });
        toTokenSelect.addEventListener('change', () => {
            updateBalancesUI();
            renderOrderBook();
            updateSwapAmounts();
        });

        fetchTokens();
    };

    init();
});