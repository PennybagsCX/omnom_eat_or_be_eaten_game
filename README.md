# $OMNOM: Shiba Crypto Takeover Game 🐶💸

## Game Concept
In this epic game, you are a Shiba Inu crypto warrior on a mission to dominate the crypto market. Eat other dogs to grow stronger and expand your blockchain empire!

## Rules
- Control the Shiba Inu using arrow keys
- Eat smaller dogs to grow
- Avoid hitting walls or yourself
- The more dogs you eat, the more $OMNOM tokens you generate!

## Quick Deploy to Replit
1. Go to [Replit](https://replit.com)
2. Click "Create Repl" and choose "Import from GitHub"
3. Paste your repository URL
4. Click "Import from GitHub"
5. The game will automatically set up and run!

## Local Development
1. Install requirements: `pip install -r requirements.txt`
2. Run the game: `python app.py`

## Controls
- ⬆️ Up Arrow: Move Up
- ⬇️ Down Arrow: Move Down
- ⬅️ Left Arrow: Move Left
- ➡️ Right Arrow: Move Right

## API Endpoints
- `/get_stats` - Get points for last hour, 24h, and 72h periods
- `/get_total_points` - Get total points across all users
- `/leaderboard` - View top players and their scores
- `/get_user_score?username=<name>` - Get specific user's score
- `/check_wallet_status?wallet_address=<address>` - Check wallet status

## File Structure
```
├── app.py              # Main application file
├── requirements.txt    # Python dependencies
├── setup.sh           # Replit setup script
├── static/            # Static files (JS, CSS)
├── templates/         # HTML templates
└── game.db           # SQLite database
```

TO THE MOON! 🚀🐕
