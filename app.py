from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import random
import sqlite3
import threading

load_dotenv()

app = Flask(__name__)
CORS(app)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///game.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Models
class Score(db.Model):
    __tablename__ = 'scores'  # Explicitly set table name
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False)
    score = db.Column(db.Integer, nullable=False)
    wallet_address = db.Column(db.String(42))  # Ethereum addresses are 42 characters
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            'username': self.username,
            'score': self.score,
            'wallet_address': self.wallet_address,
            'timestamp': self.timestamp.strftime('%Y-%m-%d %H:%M:%S')
        }

# Create tables if they don't exist
with app.app_context():
    db.create_all()

# Name generator lists
ADJECTIVES = [
    "Diamond", "Moon", "Rocket", "Crypto", "Hodl", "Degen", "Based", "Alpha", 
    "Beta", "Gamma", "Whale", "Ninja", "Shadow", "Golden", "Silver", "Cosmic"
]

NOUNS = [
    "Shiba", "Doge", "Paw", "Coin", "Token", "Wallet", "Chain", "Block",
    "Hash", "Mine", "Gem", "Hand", "Ape", "Bull", "Bear", "Wolf"
]

class User:
    def __init__(self, username, wallet_address=None):
        self.username = username
        self.wallet_address = wallet_address
        self.scores = []

    def add_score(self, score):
        self.scores.append(score)

class Game:
    def __init__(self):
        self.users = {}  # username -> User object
        self.wallet_to_username = {}  # wallet_address -> username mapping
        self.leaderboard = []
        self.lock = threading.Lock()

    def add_user(self, username, wallet_address=None):
        with self.lock:
            if username not in self.users:
                self.users[username] = User(username, wallet_address)
            if wallet_address:
                self.wallet_to_username[wallet_address.lower()] = username

    def get_username_by_wallet(self, wallet_address):
        if not wallet_address:
            return None
        return self.wallet_to_username.get(wallet_address.lower())

    def has_played_game(self, username):
        return username in self.users and len(self.users[username].scores) > 0

    def get_wallet_status(self, wallet_address):
        if not wallet_address:
            return {'has_played': False, 'username': None}
            
        username = self.get_username_by_wallet(wallet_address.lower())
        if not username:
            # Check database for historical scores
            score = Score.query.filter_by(wallet_address=wallet_address.lower()).first()
            if score:
                return {'has_played': True, 'username': score.username}
            return {'has_played': False, 'username': None}
            
        has_played = self.has_played_game(username)
        if not has_played:
            # Check database for historical scores
            score = Score.query.filter_by(wallet_address=wallet_address.lower()).first()
            has_played = score is not None
            
        return {
            'has_played': has_played,
            'username': username
        }

game = Game()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate-name')
def generate_name():
    name = f"{random.choice(ADJECTIVES)}_{random.choice(NOUNS)}{random.randint(1, 999)}"
    return jsonify({"name": name})

@app.route('/update_wallet', methods=['POST'])
def update_wallet():
    data = request.get_json()
    username = data.get('username')
    wallet_address = data.get('wallet_address')
    
    if not username or not wallet_address:
        return jsonify({'error': 'Username and wallet address required'}), 400

    # Check if this wallet already has a username with scores
    status = game.get_wallet_status(wallet_address)
    if status['has_played']:
        return jsonify({
            'username': status['username'],
            'locked': True,
            'message': f'This wallet is linked to username: {status["username"]}'
        })
    
    # If no existing username or no scores, update the wallet address
    game.add_user(username, wallet_address)
    return jsonify({'success': True})

@app.route('/check_wallet_username', methods=['POST'])
def check_wallet_username():
    data = request.get_json()
    wallet_address = data.get('wallet_address')
    
    if not wallet_address:
        return jsonify({'error': 'Wallet address required'}), 400

    username = game.get_username_by_wallet(wallet_address)
    if username and game.has_played_game(username):
        return jsonify({
            'username': username,
            'locked': True
        })
    
    return jsonify({
        'username': username,
        'locked': False
    })

@app.route('/check_wallet_status', methods=['POST'])
def check_wallet_status():
    data = request.get_json()
    wallet_address = data.get('wallet_address')
    
    if not wallet_address:
        return jsonify({'error': 'Wallet address required'}), 400

    status = game.get_wallet_status(wallet_address)
    return jsonify(status)

@app.route('/submit_score', methods=['POST'])
def submit_score():
    data = request.get_json()
    username = data.get('username')
    score = data.get('score')
    wallet_address = data.get('wallet_address')

    if not username or not isinstance(score, (int, float)):
        return jsonify({'error': 'Invalid username or score'}), 400

    game.add_user(username, wallet_address)
    user = game.users[username]
    user.add_score(score)
    
    new_score = Score(
        username=username,
        score=score,
        wallet_address=wallet_address
    )
    db.session.add(new_score)
    db.session.commit()
    
    # Calculate total score
    total_score = db.session.query(db.func.sum(Score.score)).filter_by(username=username).scalar() or 0
    
    return jsonify({
        'message': 'Score submitted successfully',
        'total_score': total_score
    })

@app.route('/get_stats')
def get_stats():
    now = datetime.utcnow()
    
    # Get time-based stats for non-overlapping periods
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(days=1)
    three_days_ago = now - timedelta(days=3)
    
    # Last hour
    last_hour = db.session.query(db.func.sum(Score.score)).filter(Score.timestamp > hour_ago).scalar() or 0
    
    # Last 24 hours (excluding last hour)
    last_24_hours = db.session.query(db.func.sum(Score.score)).filter(
        Score.timestamp > day_ago,
        Score.timestamp <= hour_ago
    ).scalar() or 0
    
    # Last 72 hours (excluding last 24 hours)
    last_72_hours = db.session.query(db.func.sum(Score.score)).filter(
        Score.timestamp > three_days_ago,
        Score.timestamp <= day_ago
    ).scalar() or 0
    
    return jsonify({
        'last_hour': last_hour,
        'last_24_hours': last_24_hours,
        'last_72_hours': last_72_hours
    })

@app.route('/leaderboard')
def leaderboard():
    try:
        # Get all scores
        scores = Score.query.all()
        
        # Create a dictionary to aggregate scores by username
        user_scores = {}
        for score in scores:
            key = (score.username, score.wallet_address)  # Use tuple of username and wallet as key
            if key in user_scores:
                user_scores[key]['score'] += score.score
                # Keep the most recent timestamp
                if score.timestamp > user_scores[key]['timestamp']:
                    user_scores[key]['timestamp'] = score.timestamp
            else:
                user_scores[key] = {
                    'username': score.username,
                    'score': score.score,
                    'wallet_address': score.wallet_address,
                    'timestamp': score.timestamp
                }
        
        # Convert dictionary to list and sort by score
        leaderboard_data = list(user_scores.values())
        leaderboard_data.sort(key=lambda x: x['score'], reverse=True)
        
        # Take top 10
        leaderboard_data = leaderboard_data[:10]
        
        # Format timestamps
        for entry in leaderboard_data:
            entry['timestamp'] = entry['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
        
        return jsonify(leaderboard_data)
    except Exception as e:
        print(f"Error fetching leaderboard: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_leaderboard')
def get_leaderboard():
    # Get top 10 scores with wallet addresses
    top_scores = db.session.query(
        Score.username,
        db.func.sum(Score.score).label('total_score'),
        Score.wallet_address
    ).group_by(Score.username).order_by(db.text('total_score DESC')).limit(10).all()
    
    leaderboard = [{
        'username': score[0],
        'score': int(score[1]),
        'wallet_address': score[2][-4:] if score[2] else None  # Only show last 4 digits
    } for score in top_scores]
    
    return jsonify(leaderboard)

@app.route('/get_user_score', methods=['GET'])
def get_user_score():
    username = request.args.get('username')
    if not username:
        return jsonify({"error": "Missing username"}), 400
    
    try:
        total_score = db.session.query(db.func.sum(Score.score)).filter_by(username=username).scalar() or 0
        return jsonify({"total_score": total_score})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get_total_points', methods=['GET'])
def get_total_points():
    try:
        total_points = db.session.query(db.func.sum(Score.score)).scalar() or 0
        return jsonify({"total_points": total_points})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002)
