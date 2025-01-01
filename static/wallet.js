// WalletConnect initialization
let provider;
let userWalletAddress = null;
let isWalletConnected = false;  // Add this flag to track connection state

async function waitForEthers() {
    return new Promise((resolve, reject) => {
        if (typeof ethers !== 'undefined') {
            resolve();
        } else {
            // Wait for ethers to be available
            const timeout = setTimeout(() => {
                reject(new Error('Ethers library failed to load'));
            }, 5000);

            window.addEventListener('load', function checkEthers() {
                if (typeof ethers !== 'undefined') {
                    clearTimeout(timeout);
                    window.removeEventListener('load', checkEthers);
                    resolve();
                }
            });
        }
    });
}

async function checkAndLockUsername(walletAddress) {
    try {
        const response = await fetch('/check_wallet_status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                wallet_address: walletAddress
            })
        });

        const data = await response.json();
        if (data.has_played && data.username) {
            const usernameInput = document.querySelector('input[type="text"]');
            const generateNameBtn = document.getElementById('generateName');
            
            usernameInput.value = data.username;
            usernameInput.disabled = true;
            generateNameBtn.style.display = 'none';
            
            // Add a locked indicator if it doesn't exist
            if (!document.getElementById('lockedIndicator')) {
                const lockedDiv = document.createElement('div');
                lockedDiv.id = 'lockedIndicator';
                lockedDiv.className = 'locked-username';
                lockedDiv.innerHTML = '🔒 Username locked';
                usernameInput.parentNode.insertBefore(lockedDiv, usernameInput.nextSibling);
            }
        }
    } catch (error) {
        console.error('Error checking wallet status:', error);
    }
}

async function initWalletConnect() {
    try {
        console.log('Initializing wallet connection...');
        
        if (window.ethereum) {
            provider = new ethers.providers.Web3Provider(window.ethereum);
            console.log('Ethers library loaded');
            console.log('MetaMask is installed!');
            
            // Check if already connected and user wants to stay connected
            const accounts = await provider.listAccounts();
            if (accounts.length > 0 && localStorage.getItem('walletConnected') === 'true') {
                userWalletAddress = accounts[0];
                isWalletConnected = true;
                console.log('Already connected:', userWalletAddress);
                updateWalletDisplay();
                
                // Check if this wallet has played before
                await checkAndLockUsername(userWalletAddress);
            }
            
            // Listen for account changes
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            
            console.log('Ethereum provider initialized');
        } else {
            console.log('Please install MetaMask!');
        }
    } catch (error) {
        console.error('Error initializing wallet:', error);
    }
}

async function connectWallet() {
    try {
        console.log('Attempting to connect wallet...');
        if (!window.ethereum) {
            alert('Please install MetaMask!');
            return null;
        }

        console.log('Requesting accounts...');
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        userWalletAddress = accounts[0];
        isWalletConnected = true;
        localStorage.setItem('walletConnected', 'true');
        
        const displayAddress = formatAddress(userWalletAddress);
        console.log('Connected accounts:', accounts);
        console.log('Display address:', displayAddress);

        // Check if this wallet has played before
        await checkAndLockUsername(userWalletAddress);

        if (userWalletAddress) {
            try {
                const usernameInput = document.querySelector('input[type="text"]');
                const username = usernameInput ? usernameInput.value.trim() : '';
                
                if (!username) {
                    console.log('No username entered yet');
                    return displayAddress;
                }

                console.log(`Updating wallet for user ${username}`);
                const response = await fetch('/update_wallet', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: username,
                        wallet_address: userWalletAddress
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    try {
                        const errorJson = JSON.parse(errorText);
                        console.error('Server error:', errorJson.error);
                    } catch (e) {
                        console.error('Server error:', errorText);
                    }
                    return displayAddress;
                }

                const data = await response.json();
                console.log('Server response:', data);
                
                if (data.locked) {
                    // Update the username input with the locked username
                    usernameInput.value = data.username;
                    usernameInput.disabled = true;
                    generateNameBtn.style.display = 'none';
                    
                    // Add a locked indicator if it doesn't exist
                    if (!document.getElementById('lockedIndicator')) {
                        const lockedDiv = document.createElement('div');
                        lockedDiv.id = 'lockedIndicator';
                        lockedDiv.className = 'locked-username';
                        lockedDiv.innerHTML = '🔒 Username locked';
                        usernameInput.parentNode.insertBefore(lockedDiv, usernameInput.nextSibling);
                    }
                }
            } catch (error) {
                console.error('Failed to update wallet on server:', error);
            }
        }

        updateWalletDisplay();
        return displayAddress;
    } catch (error) {
        console.error('Could not connect to wallet:', error);
        if (error.code !== -32001) {
            document.getElementById('walletStatus').textContent = 'Failed to connect wallet';
        }
        return null;
    }
}

async function disconnectWallet() {
    try {
        userWalletAddress = null;
        isWalletConnected = false;
        localStorage.removeItem('walletConnected');
        
        // Show MetaMask disconnection instructions
        const walletStatus = document.getElementById('walletStatus');
        walletStatus.innerHTML = `
            <div style="font-size: 10px; margin-top: 10px;">
                To fully disconnect:<br>
                1. Click MetaMask icon<br>
                2. Click your account icon<br>
                3. Click "Disconnect"
            </div>
        `;
        
        updateWalletDisplay();
        console.log('Wallet disconnected from app');
        
        return true;
    } catch (error) {
        console.error('Error disconnecting wallet:', error);
        return false;
    }
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        userWalletAddress = null;
        isWalletConnected = false;
        localStorage.removeItem('walletConnected');
        
        // Reset username input state
        const usernameInput = document.querySelector('input[type="text"]');
        const generateNameBtn = document.getElementById('generateName');
        const lockedIndicator = document.getElementById('lockedIndicator');
        
        if (usernameInput) {
            usernameInput.disabled = false;
            usernameInput.value = '';
        }
        if (generateNameBtn) {
            generateNameBtn.style.display = 'block';
        }
        if (lockedIndicator) {
            lockedIndicator.remove();
        }
        
        updateWalletDisplay();
    } else if (accounts[0] !== userWalletAddress && isWalletConnected) {
        userWalletAddress = accounts[0];
        checkAndLockUsername(userWalletAddress);
        updateWalletDisplay();
    }
}

function formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function updateWalletDisplay() {
    const walletStatus = document.getElementById('walletStatus');
    const connectWalletBtn = document.getElementById('connectWallet');
    const disconnectWalletBtn = document.getElementById('disconnectWallet');
    
    if (userWalletAddress && isWalletConnected) {
        if (!walletStatus.innerHTML.includes('To fully disconnect')) {
            walletStatus.textContent = `Connected: ${formatAddress(userWalletAddress)}`;
        }
        connectWalletBtn.style.display = 'none';
        disconnectWalletBtn.style.display = 'block';
    } else {
        if (!walletStatus.innerHTML.includes('To fully disconnect')) {
            walletStatus.textContent = '';
        }
        connectWalletBtn.style.display = 'block';
        disconnectWalletBtn.style.display = 'none';
    }
}

// Initialize WalletConnect when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing wallet...');
    setTimeout(initWalletConnect, 100);
    
    // Add click event listener to connect wallet button
    const connectWalletBtn = document.getElementById('connectWallet');
    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', async () => {
            console.log('Connect wallet button clicked');
            const walletStatus = document.getElementById('walletStatus');
            walletStatus.textContent = 'Connecting...';
            
            try {
                const displayAddress = await connectWallet();
                if (displayAddress) {
                    updateWalletDisplay();
                }
            } catch (error) {
                console.error('Wallet connection error:', error);
                if (error.code !== -32001) {
                    walletStatus.textContent = 'Failed to connect wallet';
                }
            }
        });
    }
    
    // Add click event listener to disconnect wallet button
    const disconnectWalletBtn = document.getElementById('disconnectWallet');
    if (disconnectWalletBtn) {
        disconnectWalletBtn.addEventListener('click', async () => {
            console.log('Disconnect wallet button clicked');
            const walletStatus = document.getElementById('walletStatus');
            walletStatus.textContent = 'Disconnecting...';
            
            const success = await disconnectWallet();
            if (!success) {
                walletStatus.textContent = 'Failed to disconnect';
            }
        });
    }
});

// Export functions for use in game.js
window.connectWallet = connectWallet;
window.formatAddress = formatAddress;
window.initWalletConnect = initWalletConnect;
