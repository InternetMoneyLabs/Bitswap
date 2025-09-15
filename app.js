// --- Application Main ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- STATE MANAGEMENT ---
    const state = {
        connected: false,
        address: null,
        balances: {
            ATOM: 0,
            PEPE: 0,
            ORDI: 0,
        },
        orderBook: [], // Simulated P2P Order Book
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

    // --- MOCK DATA & SIMULATION ---
    // In a real app, the Wizz Wallet API would be on the window object
    const mockWizzWallet = {
        isInstalled: true,
        requestAccounts: async () => {
            showNotification('Connecting to Mock Wallet...', 'info');
            return new Promise(resolve => setTimeout(() => resolve(['bc1q...mockxxxx']), 500));
        },
        getBalances: async () => {
            return new Promise(resolve => setTimeout(() => resolve({ ATOM: 1000, PEPE: 5000000, ORDI: 50 }), 500));
        },
        sendArc20Transaction: async (avmProgram) => {
             console.log("Broadcasting AVM Program:", JSON.stringify(avmProgram, null, 2));
             showNotification('Signing transaction...', 'info');
             return new Promise(resolve => setTimeout(() => resolve({ txid: 'mock_txid_' + Math.random().toString(36).substr(2, 9) }), 2000));
        }
    };
    
    const wizz = window.wizz || mockWizzWallet;

    const populateMockOrderBook = () => {
        state.orderBook = [
            { from: 'ATOM', to: 'PEPE', amount: 10, price: 45000, user: '87654321' },
            { from: 'ATOM', to: 'PEPE', amount: 5, price: 45100, user: '87654321' },
            { from: 'PEPE', to: 'ATOM', amount: 1000000, price: 1/45500, user: '12345678' },
            { from: 'ORDI', to: 'ATOM', amount: 2, price: 18.5, user: '12345678' },
            { from: 'ATOM', to: 'ORDI', amount: 20, price: 1/18.4, user: '56781234' },
        ];
        renderOrderBook();
    };

    // --- UI UPDATE FUNCTIONS ---
    const updateWalletUI = () => {
        if (state.connected) {
            connectWalletBtn.classList.add('hidden');
            walletInfoDiv.classList.remove('hidden');
            const addr = state.address;
            walletAddressSpan.textContent = `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
            swapBtn.textContent = 'Swap';
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

    const renderOrderBook = () => {
        if (!state.connected) return;
        
        const fromToken = fromTokenSelect.value;
        const toToken = toTokenSelect.value;
        
        const relevantOrders = state.orderBook.filter(o => o.from === fromToken && o.to === toToken);
        
        if (relevantOrders.length === 0) {
            orderBookDiv.innerHTML = `<p>No orders found for ${fromToken} → ${toToken}.</p>`;
            return;
        }

        orderBookDiv.innerHTML = relevantOrders.map(order => `
            <div class="order">
                <span>Selling: ${order.amount.toFixed(2)} ${order.from}</span>
                <span class="rate">Rate: ${order.price.toPrecision(4)} ${order.to}/${order.from}</span>
            </div>
        `).join('');
    };

    const updateSwapAmounts = () => {
        const fromAmount = parseFloat(fromAmountInput.value);
        if (isNaN(fromAmount) || fromAmount <= 0) {
            toAmountInput.value = '';
            return;
        }
        
        const fromToken = fromTokenSelect.value;
        const toToken = toTokenSelect.value;
        
        const bestOrder = state.orderBook
            .filter(o => o.from === fromToken && o.to === toToken)
            .sort((a, b) => a.price - b.price)[0];

        if (bestOrder) {
            const toAmount = fromAmount * bestOrder.price;
            toAmountInput.value = toAmount.toPrecision(6);
        } else {
            toAmountInput.value = '';
        }
    };
    
    const showNotification = (message, type = 'info') => {
        notificationToast.textContent = message;
        notificationToast.className = `show ${type}`;
        setTimeout(() => {
            notificationToast.className = 'hidden';
        }, 4000);
    };

    // --- AVM PROGRAM GENERATOR ---
    const AVMGenerator = {
        // This program is for one-sided execution, assuming the user is taking an existing order.
        // It's a simplified representation for this demo. A true atomic swap requires a more
        // complex, multi-party AVM program or a commit-reveal scheme.
        createSettleOrderProgram: (userAddress, counterpartyAddress, userSends, counterpartySends) => {
            return [
                // Transfer from user to counterparty
                {"Push":{"Push": userAddress}},
                {"Push":{"Push": counterpartyAddress}},
                {"Push":{"Push": userSends.amount}},
                {"Transfer":{"Transfer":null}},
                // Transfer from counterparty to user
                {"Push":{"Push": counterpartyAddress}},
                {"Push":{"Push": userAddress}},
                {"Push":{"Push": counterpartySends.amount}},
                {"Transfer":{"Transfer":null}},
                // Return to end execution
                {"Return":{"Return":null}}
            ];
        }
    };

    // --- APPLICATION LOGIC ---
    const handleConnectWallet = async () => {
        if (!wizz || !wizz.isInstalled) {
            showNotification('Wizz Wallet not found. Please install the extension.', 'error');
            return;
        }
        try {
            const accounts = await wizz.requestAccounts();
            if (accounts && accounts.length > 0) {
                state.connected = true;
                state.address = accounts[0];
                const balances = await wizz.getBalances();
                state.balances = { ...state.balances, ...balances };
                updateWalletUI();
                populateMockOrderBook();
                showNotification('Wallet connected successfully!', 'success');
            }
        } catch (error) {
            showNotification('Failed to connect wallet.', 'error');
            console.error(error);
        }
    };
    
    const handleInitiateSwap = () => {
        const fromAmount = parseFloat(fromAmountInput.value);
        const toAmount = parseFloat(toAmountInput.value);
        const fromToken = fromTokenSelect.value;
        const toToken = toTokenSelect.value;

        if (fromToken === toToken) {
            showNotification('Cannot swap the same token.', 'error');
            return;
        }
        if (isNaN(fromAmount) || fromAmount <= 0) {
            showNotification('Please enter a valid amount.', 'error');
            return;
        }
        if (fromAmount > state.balances[fromToken]) {
            showNotification('Insufficient balance.', 'error');
            return;
        }

        const matchingOrder = state.orderBook.find(o => o.from === fromToken && o.to === toToken);
        if (!matchingOrder) {
            showNotification('No available orders to match this swap.', 'error');
            return;
        }

        state.currentSwap = {
            fromToken,
            toToken,
            fromAmount,
            toAmount,
            counterpartyAddress: matchingOrder.user // Use address from the matched order
        };
        
        swapSummaryDiv.innerHTML = `
            <strong>${state.currentSwap.fromAmount.toFixed(4)} ${state.currentSwap.fromToken}</strong>
            <br>
            for
            <br>
            <strong>${state.currentSwap.toAmount.toPrecision(6)} ${state.currentSwap.toToken}</strong>
        `;
        confirmationModal.classList.remove('hidden');
    };

    const handleConfirmSwap = async () => {
        if (!state.currentSwap) return;
        
        confirmationModal.classList.add('hidden');
        showNotification('Preparing transaction...', 'info');

        // For demo, we use magic numbers for wallet addresses if the real one is a mock
        const userAddr = state.address.startsWith('bc1q') ? 56781234 : state.address;
        const counterpartyAddr = parseInt(state.currentSwap.counterpartyAddress, 10);
        
        const avmProgram = AVMGenerator.createSettleOrderProgram(
            userAddr, 
            counterpartyAddr,
            { token: state.currentSwap.fromToken, amount: state.currentSwap.fromAmount },
            { token: state.currentSwap.toToken, amount: state.currentSwap.toAmount }
        );

        try {
            const result = await wizz.sendArc20Transaction(avmProgram);
            showNotification(`Swap submitted! TXID: ${result.txid.substring(0, 16)}...`, 'success');

            setTimeout(() => {
                state.balances[state.currentSwap.fromToken] -= state.currentSwap.fromAmount;
                state.balances[state.currentSwap.toToken] += state.currentSwap.toAmount;
                updateBalancesUI();
                fromAmountInput.value = '';
                toAmountInput.value = '';
                showNotification('Balances updated!', 'success');
            }, 8000);

        } catch (error) {
            showNotification('Transaction failed or was rejected.', 'error');
            console.error(error);
        } finally {
            state.currentSwap = null;
        }
    };

    const handleCancelSwap = () => {
        confirmationModal.classList.add('hidden');
        state.currentSwap = null;
    };
    
    // --- EVENT LISTENERS ---
    connectWalletBtn.addEventListener('click', handleConnectWallet);
    swapBtn.addEventListener('click', handleInitiateSwap);
    confirmSwapBtn.addEventListener('click', handleConfirmSwap);
    cancelSwapBtn.addEventListener('click', handleCancelSwap);

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
});