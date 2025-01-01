// Add these variables at the top
let canvas = document.getElementById('gameCanvas');
let ctx = canvas.getContext('2d');
let lastStatsUpdate = 0;
const STATS_UPDATE_INTERVAL = 5000; // Update every 5 seconds

// Set canvas size
canvas.width = 800;
canvas.height = 600;

// Initialize game state
let gameStarted = false;
let gameOver = false;
let score = 0;
let totalScore = 0;  // Will be loaded from server
let lives = 3;
let username = '';
let isGameActive = false;
let countdownActive = false;

// Game objects
let shiba = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    dx: 0,
    dy: 0,
    speed: 0.15,
    baseSpeed: 0.15,
    scoreMultiplier: 1,
    facingLeft: false
};

let dogs = [];
let bombs = [];
let explosions = [];
let sparks = [];
let eatenEffects = [];
let powerUps = [];
let powerUpEffects = [];

// Constants
const GRID_SIZE = 20;
const BOMB_FADE_INTERVAL = 3000;
const EXPLOSION_DURATION = 500;
const SPARK_DURATION = 300;
const EATEN_DURATION = 500;
const POWER_UP_DURATION = 5000;
const POWER_UP_SPEED_MULTIPLIER = 2;
const POWER_UP_SCORE_MULTIPLIER = 2;

// Game sprites
const SPRITES = {
    SHIBA: '🐕',
    DOG: '🐶',
    BOMB: '💣',
    EXPLOSION: '💥',
    SPARK: '⚡',
    EATEN: '🍽️',
    STAR: '⭐',
    LIGHTNING: '⚡'
};

// Make canvas responsive
function resizeCanvas() {
    const container = document.querySelector('.game-container');
    const maxWidth = Math.min(800, container.clientWidth - 40);
    canvas.width = maxWidth;
    canvas.height = maxWidth * 0.6;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let GRID_WIDTH = Math.floor(canvas.width / GRID_SIZE);
let GRID_HEIGHT = Math.floor(canvas.height / GRID_SIZE);

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize wallet connect
    if (typeof window.initWalletConnect === 'function') {
        await window.initWalletConnect();
    }

    const connectWalletBtn = document.getElementById('connectWallet');
    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', async () => {
            const walletStatus = document.getElementById('walletStatus');
            walletStatus.textContent = 'Connecting...';
            
            try {
                const displayAddress = await window.connectWallet();
                if (displayAddress) {
                    walletStatus.textContent = `Connected: ${displayAddress}`;
                    connectWalletBtn.style.display = 'none';
                }
            } catch (error) {
                walletStatus.textContent = 'Failed to connect wallet';
                console.error('Wallet connection error:', error);
            }
        });
    }

    const usernameModal = document.getElementById('usernameModal');
    const usernameInput = document.getElementById('username');
    const generateNameBtn = document.getElementById('generateName');
    const startWithNameBtn = document.getElementById('startWithName');
    const leaderboardModal = document.getElementById('leaderboardModal');
    const viewLeaderboardBtns = document.querySelectorAll('.view-leaderboard');
    const closeLeaderboardBtn = document.querySelector('.close-leaderboard');
    const restartButton = document.querySelector('.restart-button');
    const gameOverScreen = document.querySelector('.game-over');
    
    // Show username modal on load
    usernameModal.classList.add('active');
    
    // Generate random name
    generateNameBtn.addEventListener('click', async () => {
        const response = await fetch('/generate-name');
        const data = await response.json();
        usernameInput.value = data.name;
    });
    
    // Start game with username
    startWithNameBtn.addEventListener('click', async () => {
        if (usernameInput.value.trim()) {
            username = usernameInput.value.trim();
            usernameModal.classList.remove('active');
            
            // Load user's previous score
            try {
                const response = await fetch(`/get_user_score?username=${encodeURIComponent(username)}`);
                const data = await response.json();
                totalScore = parseInt(data.total_score) || 0;
                score = 0; // Reset current game score
            } catch (error) {
                console.error('Error loading user score:', error);
                totalScore = 0;
            }
            
            await initGame();  // Wait for game initialization
            showInstructions();
        }
    });
    
    // View leaderboard functionality
    viewLeaderboardBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            gameOverScreen.style.display = 'none';  // Hide game over screen
            showLeaderboard();
        });
    });
    
    // Close leaderboard
    closeLeaderboardBtn.addEventListener('click', () => {
        leaderboardModal.classList.remove('active');
        if (gameOver) {
            gameOverScreen.style.display = 'flex';  // Show game over screen again
        }
    });
    
    // Restart game
    restartButton.addEventListener('click', async () => {
        gameOverScreen.style.display = 'none';
        
        // Reload user's total score before starting new game
        try {
            const response = await fetch(`/get_user_score?username=${encodeURIComponent(username)}`);
            const data = await response.json();
            totalScore = parseInt(data.total_score) || 0;
        } catch (error) {
            console.error('Error loading user score:', error);
            // Keep existing totalScore if fetch fails
        }
        
        await initGame();  // Wait for game initialization
        startCountdown();
    });
    
    async function updateNetworkStats() {
        try {
            const [statsResponse, totalPointsResponse] = await Promise.all([
                fetch('/get_stats'),
                fetch('/get_total_points')
            ]);
            
            const stats = await statsResponse.json();
            const totalPoints = await totalPointsResponse.json();
            
            // Animate all stats including total points
            animateValue('hourStats', stats.last_hour);
            animateValue('dayStats', stats.last_24_hours);
            animateValue('threeStats', stats.last_72_hours);
            animateValue('totalPoints', totalPoints.total_points);
        } catch (error) {
            console.error('Error updating network stats:', error);
        }
    }
    
    // Update stats every 5 seconds
    setInterval(updateNetworkStats, 5000);
    
    updateNetworkStats();
    updatePointStats();
});

// Add this function to show leaderboard
function showLeaderboard() {
    const leaderboardModal = document.getElementById('leaderboardModal');
    const leaderboardList = document.getElementById('leaderboardList');
    
    fetch('/leaderboard')
        .then(response => response.json())
        .then(leaderboard => {
            leaderboardList.innerHTML = leaderboard.map((entry, index) => {
                // Format the timestamp
                const date = new Date(entry.timestamp);
                const formattedDate = date.toLocaleDateString();
                
                // Format the score with commas
                const formattedScore = entry.score.toLocaleString();
                
                // Determine rank emoji
                let rankEmoji = '#' + (index + 1);
                if (index === 0) rankEmoji = '👑';
                else if (index === 1) rankEmoji = '🥈';
                else if (index === 2) rankEmoji = '🥉';
                
                // Format wallet address
                const walletDisplay = entry.wallet_address ? 
                    `<a href="https://explorer.dogechain.dog/address/${entry.wallet_address}" 
                        target="_blank" 
                        class="wallet-link" 
                        title="View on Dogechain Explorer">
                        ${entry.wallet_address.slice(-4)}
                    </a>` : '';
                
                return `
                    <div class="leaderboard-entry ${entry.username === username ? 'current-user' : ''}">
                        <span class="rank">${rankEmoji}</span>
                        <span class="username">${entry.username}</span>
                        <span class="score">${formattedScore} pts</span>
                        <span class="wallet">${walletDisplay}</span>
                        <span class="date">${formattedDate}</span>
                    </div>
                `;
            }).join('');
            
            leaderboardModal.classList.add('active');
        })
        .catch(error => console.error('Error fetching leaderboard:', error));
}

// Update updateLeaderboard function to show wallet addresses
async function updateLeaderboard() {
    const response = await fetch('/get_leaderboard');
    const leaderboard = await response.json();
    
    const leaderboardList = document.getElementById('leaderboardList');
    leaderboardList.innerHTML = '';
    
    leaderboard.forEach((entry, index) => {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'leaderboard-entry';
        
        const rankSpan = document.createElement('span');
        rankSpan.className = 'rank';
        rankSpan.textContent = `#${index + 1}`;
        
        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'username';
        usernameSpan.textContent = entry.username;
        
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'score';
        scoreSpan.textContent = entry.score;
        
        const walletSpan = document.createElement('span');
        walletSpan.className = 'wallet-address';
        if (entry.wallet_address) {
            walletSpan.textContent = `...${entry.wallet_address}`;
            walletSpan.title = 'View on Etherscan';
            walletSpan.onclick = () => {
                window.open(`https://etherscan.io/address/${entry.wallet_address}`, '_blank');
            };
        }
        
        entryDiv.appendChild(rankSpan);
        entryDiv.appendChild(usernameSpan);
        entryDiv.appendChild(scoreSpan);
        entryDiv.appendChild(walletSpan);
        leaderboardList.appendChild(entryDiv);
    });
}

function showInstructions() {
    const instructionsScreen = document.createElement('div');
    instructionsScreen.className = 'instructions-screen';
    instructionsScreen.innerHTML = `
        <div class="instructions-content">
            <h2>How to Play</h2>
            <ul>
                <li>🎮 Use arrow keys or WASD to move</li>
                <li>🐕 Eat other dogs to gain points</li>
                <li>💣 Avoid the bombs!</li>
                <li>💎 Collect power-ups for bonuses</li>
                <li>❤️ You have 3 lives - make them count!</li>
            </ul>
            <button class="start-button">START</button>
        </div>
    `;
    document.body.appendChild(instructionsScreen);

    const startButton = instructionsScreen.querySelector('.start-button');
    startButton.addEventListener('click', () => {
        document.body.removeChild(instructionsScreen);
        gameStarted = true;
        isGameActive = true;
        toggleScrollLock(true);
        startCountdown(); // Start countdown before game begins
    });
}

function startCountdown() {
    let countdownValue = 3;
    const canvas = document.getElementById('gameCanvas');
    const countdownElement = document.createElement('div');
    countdownElement.className = 'countdown';
    
    // Create a container that matches canvas size and position
    const countdownContainer = document.createElement('div');
    countdownContainer.className = 'countdown-container';
    const canvasRect = canvas.getBoundingClientRect();
    countdownContainer.style.width = canvas.width + 'px';
    countdownContainer.style.height = canvas.height + 'px';
    countdownContainer.style.position = 'absolute';
    countdownContainer.style.left = canvas.offsetLeft + 'px';
    countdownContainer.style.top = canvas.offsetTop + 'px';
    countdownContainer.style.overflow = 'hidden';
    
    countdownContainer.appendChild(countdownElement);
    canvas.parentElement.appendChild(countdownContainer);

    const countdownInterval = setInterval(() => {
        if (countdownValue > 0) {
            countdownElement.textContent = countdownValue;
            countdownValue--;
        } else {
            countdownElement.textContent = 'GO!';
            setTimeout(() => {
                countdownContainer.remove();
                initGame();
                gameLoop();
            }, 1000);
            clearInterval(countdownInterval);
        }
    }, 1000);
}

// Game functions
function toggleScrollLock(enable) {
    document.body.style.overflow = enable ? 'hidden' : 'auto';
    document.querySelector('.game-container').style.overflow = enable ? 'hidden' : 'auto';
}

function focusCanvas() {
    canvas.focus();
}

function drawShiba() {
    ctx.save();
    ctx.font = GRID_SIZE + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Set up the transformation
    ctx.translate(
        shiba.x * GRID_SIZE + GRID_SIZE/2,
        shiba.y * GRID_SIZE + GRID_SIZE/2
    );
    
    // Scale x by -1 if facing left
    if (shiba.facingLeft) {
        ctx.scale(-1, 1);
    }
    
    // Draw the emoji at the origin (0, 0) since we've translated
    ctx.fillText(SPRITES.SHIBA, 0, 0);
    
    ctx.restore();
}

function drawDogs() {
    ctx.font = GRID_SIZE + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    dogs.forEach(dog => {
        ctx.fillText(
            SPRITES.DOG,
            dog.x * GRID_SIZE + GRID_SIZE/2,
            dog.y * GRID_SIZE + GRID_SIZE/2
        );
    });
}

function drawBombs() {
    ctx.font = GRID_SIZE + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    bombs.forEach(bomb => {
        if (bomb.visible) {
            ctx.fillText(
                SPRITES.BOMB,
                bomb.x * GRID_SIZE + GRID_SIZE/2,
                bomb.y * GRID_SIZE + GRID_SIZE/2
            );
        }
    });
}

function createSpark(x, y) {
    sparks.push({
        x: x,
        y: y,
        created: Date.now(),
        alpha: 1
    });
}

function updateSparks() {
    const currentTime = Date.now();
    sparks = sparks.filter(spark => {
        const age = currentTime - spark.created;
        spark.alpha = 1 - (age / SPARK_DURATION);
        return age < SPARK_DURATION;
    });
}

function drawSparks() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    sparks.forEach(spark => {
        ctx.globalAlpha = spark.alpha;
        ctx.font = (GRID_SIZE * 1.5) + 'px Arial';
        ctx.fillText(
            SPRITES.SPARK,
            spark.x * GRID_SIZE + GRID_SIZE/2,
            spark.y * GRID_SIZE + GRID_SIZE/2
        );
    });
    ctx.globalAlpha = 1;
}

function createExplosion(x, y) {
    explosions.push({
        x: x,
        y: y,
        created: Date.now()
    });
}

function updateExplosions() {
    const currentTime = Date.now();
    explosions = explosions.filter(explosion => 
        currentTime - explosion.created < EXPLOSION_DURATION
    );
}

function drawExplosions() {
    ctx.font = GRID_SIZE + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    explosions.forEach(explosion => {
        ctx.fillText(
            SPRITES.EXPLOSION,
            explosion.x * GRID_SIZE + GRID_SIZE/2,
            explosion.y * GRID_SIZE + GRID_SIZE/2
        );
    });
}

function createEatenEffect(x, y) {
    eatenEffects.push({
        x: x,
        y: y,
        created: Date.now(),
        alpha: 1
    });
}

function updateEatenEffects() {
    const currentTime = Date.now();
    eatenEffects = eatenEffects.filter(effect => {
        const age = currentTime - effect.created;
        effect.alpha = 1 - (age / EATEN_DURATION);
        return age < EATEN_DURATION;
    });
}

function drawEatenEffects() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    eatenEffects.forEach(effect => {
        ctx.globalAlpha = effect.alpha;
        ctx.font = GRID_SIZE + 'px Arial';
        ctx.fillText(
            SPRITES.EATEN,
            effect.x * GRID_SIZE + GRID_SIZE/2,
            effect.y * GRID_SIZE + GRID_SIZE/2
        );
    });
    ctx.globalAlpha = 1;
}

function generatePowerUp() {
    const position = getRandomPosition('⭐');
    return {
        x: position.x,
        y: position.y,
        type: 'star',
        visible: true
    };
}

function updatePowerUps() {
    // Check if power-up is active
    if (shiba.powerUpActive && Date.now() > shiba.powerUpEndTime) {
        shiba.powerUpActive = false;
        shiba.speed = shiba.baseSpeed;
        shiba.scoreMultiplier = 1;
    }
    
    // Maintain one power-up
    if (powerUps.length < 1) {
        powerUps.push(generatePowerUp());
    }
}

function drawPowerUps() {
    ctx.font = GRID_SIZE + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    powerUps.forEach(powerUp => {
        if (powerUp.visible) {
            ctx.fillText(
                SPRITES.STAR,
                powerUp.x * GRID_SIZE + GRID_SIZE/2,
                powerUp.y * GRID_SIZE + GRID_SIZE/2
            );
        }
    });
}

function createPowerUpEffect(x, y) {
    powerUpEffects.push({
        x: x,
        y: y,
        created: Date.now(),
        alpha: 1
    });
}

function updatePowerUpEffects() {
    const currentTime = Date.now();
    powerUpEffects = powerUpEffects.filter(effect => {
        const age = currentTime - effect.created;
        effect.alpha = 1 - (age / SPARK_DURATION);
        return age < SPARK_DURATION;
    });
}

function drawPowerUpEffects() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    powerUpEffects.forEach(effect => {
        ctx.globalAlpha = effect.alpha;
        ctx.font = (GRID_SIZE * 1.5) + 'px Arial';
        ctx.fillText(
            SPRITES.LIGHTNING,
            effect.x * GRID_SIZE + GRID_SIZE/2,
            effect.y * GRID_SIZE + GRID_SIZE/2
        );
    });
    ctx.globalAlpha = 1;
}

function updateShiba() {
    shiba.x += shiba.dx * shiba.speed;
    shiba.y += shiba.dy * shiba.speed;
    
    // Bounce off walls
    if (shiba.x < 0 || shiba.x >= GRID_WIDTH) {
        shiba.dx *= -1;
        shiba.x = Math.max(0, Math.min(shiba.x, GRID_WIDTH - 1));
    }
    if (shiba.y < 0 || shiba.y >= GRID_HEIGHT) {
        shiba.dy *= -1;
        shiba.y = Math.max(0, Math.min(shiba.y, GRID_HEIGHT - 1));
    }
}

function generateDog() {
    const position = getRandomPosition('🐕');
    return {
        x: position.x,
        y: position.y,
        dx: (Math.random() - 0.5) * 0.6,
        dy: (Math.random() - 0.5) * 0.6,
        speed: 0.375
    };
}

function generateBomb() {
    const position = getRandomPosition('💣');
    return {
        x: position.x,
        y: position.y,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        speed: 0.2,
        visible: true,
        fadeTime: Date.now() + BOMB_FADE_INTERVAL
    };
}

async function initGame() {
    resizeCanvas();
    GRID_WIDTH = Math.floor(canvas.width / GRID_SIZE);
    GRID_HEIGHT = Math.floor(canvas.height / GRID_SIZE);
    
    // Load the latest total score from the server before starting
    if (username) {
        try {
            const response = await fetch(`/get_user_score?username=${encodeURIComponent(username)}`);
            const data = await response.json();
            totalScore = parseInt(data.total_score) || 0;
        } catch (error) {
            console.error('Error loading user score:', error);
            // Keep existing totalScore if fetch fails
        }
    }
    
    // Reset current game score and stats
    score = 0;
    lives = 3;
    gameOver = false;
    
    shiba = {
        x: Math.floor(GRID_WIDTH/2),
        y: Math.floor(GRID_HEIGHT/2),
        dx: 1,
        dy: 0,
        speed: 0.15,
        baseSpeed: 0.15,
        powerUpActive: false,
        powerUpEndTime: 0,
        scoreMultiplier: 1,
        facingLeft: false
    };
    
    dogs = [];
    bombs = [];
    explosions = [];
    sparks = [];
    eatenEffects = [];
    powerUps = [];
    powerUpEffects = [];
    
    // Generate initial dogs and bombs
    for (let i = 0; i < 3; i++) {
        dogs.push(generateDog());
    }
    
    for (let i = 0; i < 2; i++) {
        bombs.push(generateBomb());
    }
    
    document.querySelector('.game-over').style.display = 'none';
}

async function submitScore(score) {
    try {
        const response = await fetch('/submit_score', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                score: score,
                wallet_address: userWalletAddress
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit score');
        }
        
        const data = await response.json();
        console.log('Score submitted successfully:', data);
        
        // After submitting score, check if we need to lock the username
        const usernameInput = document.querySelector('input[type="text"]');
        const generateNameBtn = document.getElementById('generateName');
        
        if (!usernameInput.disabled) {
            usernameInput.disabled = true;
            generateNameBtn.style.display = 'none';
            
            if (!document.getElementById('lockedIndicator')) {
                const lockedDiv = document.createElement('div');
                lockedDiv.id = 'lockedIndicator';
                lockedDiv.className = 'locked-username';
                lockedDiv.innerHTML = '🔒 Username locked';
                usernameInput.parentNode.insertBefore(lockedDiv, usernameInput.nextSibling);
            }
        }
        
        return data;
    } catch (error) {
        console.error('Error submitting score:', error);
        return null;
    }
}

function updateScore(points) {
    score += points;
    
    // Update score display
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        scoreElement.textContent = `Score: ${score}`;
    }
    
    // Submit score to backend and update total score
    submitScore(points).then(response => {
        if (response && response.total_score !== undefined) {
            totalScore = response.total_score;
            if (scoreElement) {
                scoreElement.textContent = `Score: ${score} (Total: ${totalScore})`;
            }
        }
    });
}

function updatePointStats() {
    fetch('/get_stats')
        .then(response => response.json())
        .then(data => {
            // Animate the number changes
            animateValue('hourStats', data.last_hour);
            animateValue('dayStats', data.last_24_hours);
            animateValue('threeStats', data.last_72_hours);
        })
        .catch(error => console.error('Error fetching stats:', error));
}

function animateValue(elementId, end) {
    const element = document.getElementById(elementId);
    const start = parseInt(element.textContent.replace(/,/g, ''));
    const duration = 1000; // 1 second animation
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const current = Math.floor(start + (end - start) * progress);
        element.textContent = current.toLocaleString();
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function updateLives() {
    lives--;
}

function updateDogs() {
    dogs.forEach(dog => {
        dog.x += dog.dx * dog.speed;
        dog.y += dog.dy * dog.speed;
        
        // Bounce off walls
        if (dog.x < 0 || dog.x >= GRID_WIDTH) {
            dog.dx *= -1;
            dog.x = Math.max(0, Math.min(dog.x, GRID_WIDTH - 1));
        }
        if (dog.y < 0 || dog.y >= GRID_HEIGHT) {
            dog.dy *= -1;
            dog.y = Math.max(0, Math.min(dog.y, GRID_HEIGHT - 1));
        }
    });
}

function updateBombs() {
    const now = Date.now();
    
    // Update bomb visibility
    bombs.forEach(bomb => {
        if (now >= bomb.fadeTime) {
            bomb.visible = !bomb.visible;
            bomb.fadeTime = now + BOMB_FADE_INTERVAL;
        }
    });
    
    // Maintain 2-3 visible bombs
    const visibleBombs = bombs.filter(bomb => bomb.visible).length;
    if (visibleBombs < 2) {
        bombs.push(generateBomb());
    }
    
    bombs.forEach(bomb => {
        bomb.x += bomb.dx * bomb.speed;
        bomb.y += bomb.dy * bomb.speed;
        
        // Bounce off walls
        if (bomb.x < 0 || bomb.x >= GRID_WIDTH) {
            bomb.dx *= -1;
            bomb.x = Math.max(0, Math.min(bomb.x, GRID_WIDTH - 1));
        }
        if (bomb.y < 0 || bomb.y >= GRID_HEIGHT) {
            bomb.dy *= -1;
            bomb.y = Math.max(0, Math.min(bomb.y, GRID_HEIGHT - 1));
        }
    });
}

function checkCollisions() {
    const shibaPos = {x: Math.round(shiba.x), y: Math.round(shiba.y)};
    
    // Check dog collisions
    for (let i = dogs.length - 1; i >= 0; i--) {
        const dog = dogs[i];
        if (Math.abs(shibaPos.x - dog.x) < 1 && Math.abs(shibaPos.y - dog.y) < 1) {
            // Award 1 point for eating a dog, doubled if power-up is active
            const points = shiba.powerUpActive ? 2 : 1;
            updateScore(points);
            createEatenEffect(dog.x, dog.y);
            dogs.splice(i, 1);
            // Spawn new dog immediately
            dogs.push(generateDog());
        }
    }

    // Check for power-up collisions
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        if (powerUp.visible && Math.abs(shibaPos.x - powerUp.x) < 1 && Math.abs(shibaPos.y - powerUp.y) < 1) {
            createPowerUpEffect(powerUp.x, powerUp.y);
            powerUps.splice(i, 1);
            
            // Activate power-up
            shiba.powerUpActive = true;
            shiba.powerUpEndTime = Date.now() + POWER_UP_DURATION;
            shiba.speed = shiba.baseSpeed * POWER_UP_SPEED_MULTIPLIER;
            shiba.scoreMultiplier = POWER_UP_SCORE_MULTIPLIER;
        }
    }

    // Check bomb collisions
    for (let i = bombs.length - 1; i >= 0; i--) {
        const bomb = bombs[i];
        if (bomb.visible && Math.abs(shibaPos.x - bomb.x) < 1 && Math.abs(shibaPos.y - bomb.y) < 1) {
            createExplosion(bomb.x, bomb.y);
            createSpark(bomb.x, bomb.y);
            bombs.splice(i, 1);
            updateLives();
            // Spawn new bomb immediately
            bombs.push(generateBomb());
            
            if (lives <= 0) {
                handleGameOver();
            }
        }
    }
}

function drawGameStats() {
    ctx.save();
    
    // Draw lives in top left
    ctx.font = '20px "Press Start 2P"';
    ctx.fillStyle = '#ff4444';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('❤️'.repeat(lives), 20, 20);
    
    // Draw scores below lives
    ctx.font = '16px "Press Start 2P"';
    ctx.fillStyle = '#00ff00';
    ctx.fillText(`$OMNOM: ${score}`, 20, 50);
    ctx.fillText(`TOTAL: ${totalScore}`, 20, 75);
    
    // Draw username in top center
    ctx.font = '16px "Press Start 2P"';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.fillText(username, canvas.width/2, 20);
    
    // Draw power-up timer in top right
    if (shiba.powerUpActive) {
        ctx.font = '14px "Press Start 2P"';
        ctx.fillStyle = '#00ffff';
        ctx.textAlign = 'right';
        const timeLeft = Math.ceil((shiba.powerUpEndTime - Date.now()) / 1000);
        ctx.fillText(`POWER-UP: ${timeLeft}s`, canvas.width - 20, 20);
    }
    
    ctx.restore();
}

function gameLoop() {
    if (!gameOver && !countdownActive) {
        const currentTime = Date.now();
        
        // Update stats every 3 seconds
        if (currentTime - lastStatsUpdate > 3000) {
            updatePointStats();
            lastStatsUpdate = currentTime;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        updateShiba();
        updateDogs();
        updateBombs();
        updateExplosions();
        updateSparks();
        updateEatenEffects();
        updatePowerUps();
        updatePowerUpEffects();
        
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        drawDogs();
        drawBombs();
        drawShiba();
        drawExplosions();
        drawSparks();
        drawEatenEffects();
        drawPowerUps();
        drawPowerUpEffects();
        drawGameStats();
        
        // Draw airdrop hint with specific opacity and word wrap
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.font = '12px "Press Start 2P"';
        ctx.fillStyle = '#ffd700';
        ctx.textAlign = 'center';
        const airdropText = "$OMNOM HOLDERS & PLAYERS";
        const airdropText2 = "MAY RECEIVE FUTURE AIRDROPS!";
        ctx.fillText(airdropText, canvas.width/2, canvas.height - 30);
        ctx.fillText(airdropText2, canvas.width/2, canvas.height - 15);
        ctx.restore();
        
        checkCollisions();
        
        requestAnimationFrame(gameLoop);
    }
}

// Controls
document.addEventListener('keydown', function(e) {
    // Prevent scrolling for arrow keys
    if([37, 38, 39, 40].indexOf(e.keyCode) > -1) {
        e.preventDefault();
    }
});

document.addEventListener('keydown', function(e) {
    if (!gameStarted) {
        if (e.key === 'Enter' || e.key === ' ') {
            gameStarted = true;
            startCountdown();
        }
        return;
    }
    
    if (gameOver) {
        if (e.key === 'Enter' || e.key === ' ') {
            gameStarted = false;
            gameOver = false;
            initGame();
            drawStartScreen();
        }
        return;
    }

    switch(e.keyCode) {
        case 37: // Left
            e.preventDefault();
            shiba.dx = -1;
            shiba.dy = 0;
            shiba.facingLeft = false;
            break;
        case 38: // Up
            e.preventDefault();
            shiba.dx = 0;
            shiba.dy = -1;
            break;
        case 39: // Right
            e.preventDefault();
            shiba.dx = 1;
            shiba.dy = 0;
            shiba.facingLeft = true;
            break;
        case 40: // Down
            e.preventDefault();
            shiba.dx = 0;
            shiba.dy = 1;
            break;
    }
});

canvas.addEventListener('touchstart', handleTouchMove);
canvas.addEventListener('mousedown', handleTouchMove);

function handleTouchMove(e) {
    if (!isGameActive || gameOver) return;
    
    e.preventDefault();
    
    // Get touch/click coordinates relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = (e.type === 'touchstart' ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.type === 'touchstart' ? e.touches[0].clientY : e.clientY) - rect.top;
    
    // Calculate center of canvas
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Calculate direction based on tap position relative to center
    const dx = x - centerX;
    const dy = y - centerY;
    
    // Determine primary direction based on which difference is larger
    if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal movement
        shiba.dx = dx > 0 ? 1 : -1;
        shiba.dy = 0;
        shiba.facingLeft = dx > 0;
    } else {
        // Vertical movement
        shiba.dx = 0;
        shiba.dy = dy > 0 ? 1 : -1;
    }
}

// Make canvas focusable
canvas.setAttribute('tabindex', '0');

function handleGameOver() {
    gameOver = true;
    isGameActive = false;
    toggleScrollLock(false);
    
    const gameOverScreen = document.querySelector('.game-over');
    const finalScoreDisplay = document.querySelector('.final-score');
    const highScoreMessage = document.querySelector('.high-score-message');
    
    finalScoreDisplay.textContent = score;
    
    // Submit score to leaderboard
    submitScore(score);
    
    gameOverScreen.style.display = 'flex';
}

function getRandomPosition(emoji) {
    const gridPadding = 2;  // Grid cells padding
    const topUIGridHeight = 4;  // Grid cells reserved for UI elements at top
    
    let x, y;
    let attempts = 0;
    const maxAttempts = 50;
    
    do {
        x = gridPadding + Math.floor(Math.random() * (GRID_WIDTH - 2 * gridPadding));
        y = topUIGridHeight + Math.floor(Math.random() * (GRID_HEIGHT - topUIGridHeight - gridPadding));
        attempts++;
        
        // Check if position would overlap with any existing game objects
        const overlap = [...dogs, ...bombs, ...powerUps].some(obj => {
            return Math.abs(x - obj.x) < 2 && Math.abs(y - obj.y) < 2;
        });
        
        if (!overlap || attempts >= maxAttempts) {
            break;
        }
    } while (true);
    
    return { x, y };
}

function generatePowerUp() {
    const position = getRandomPosition('⭐');
    return {
        x: position.x,
        y: position.y,
        type: 'star',
        visible: true
    };
}

function generateDog() {
    const position = getRandomPosition('🐕');
    return {
        x: position.x,
        y: position.y,
        dx: (Math.random() - 0.5) * 0.6,
        dy: (Math.random() - 0.5) * 0.6,
        speed: 0.375
    };
}

function generateBomb() {
    const position = getRandomPosition('💣');
    return {
        x: position.x,
        y: position.y,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        speed: 0.2,
        visible: true,
        fadeTime: Date.now() + BOMB_FADE_INTERVAL
    };
}
