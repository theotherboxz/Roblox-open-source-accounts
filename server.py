from flask import Flask, request, jsonify, render_template_string
import os
import json

app = Flask(__name__)

DATA_FILE = "stored_credentials.json"

# Ensure data file exists
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, "w") as f:
        json.dump([], f)

@app.route('/')
def home():
    # Load and display stored data
    try:
        with open(DATA_FILE, "r") as f:
            data = json.load(f)
    except:
        data = []
    
    # Simple HTML template
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Credential Storage</title>
    </head>
    <body>
        <h1>Stored Credentials</h1>
        <ul>
        {% for item in data %}
            <li>{{ item }}</li>
        {% endfor %}
        </ul>
    </body>
    </html>
    """
    return render_template_string(html, data=data)

@app.route('/receive', methods=['POST'])
def receive():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Load existing data
        with open(DATA_FILE, "r") as f:
            stored = json.load(f)
        
        # Append new data
        stored.append(data)
        
        # Save back
        with open(DATA_FILE, "w") as f:
            json.dump(stored, f, indent=4)
        
        return jsonify({"message": "Data stored successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)