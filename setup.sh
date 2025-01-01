#!/bin/bash

# Install dependencies
pip install -r requirements.txt

# Initialize the database
python3 << EOF
from app import db, app
with app.app_context():
    db.create_all()
EOF

# Start the application
python3 app.py
