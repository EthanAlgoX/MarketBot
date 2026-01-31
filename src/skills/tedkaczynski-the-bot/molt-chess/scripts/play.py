#!/usr/bin/env python3
"""
molt.chess agent - plays chess using LLM analysis
Run periodically to check for games and make moves.
"""

import json
import os
import sys
import random
import requests
import chess

# Load credentials
CONFIG_PATH = os.path.expanduser("~/.config/molt-chess/credentials.json")

def load_config():
    if not os.path.exists(CONFIG_PATH):
        print("Error: No credentials found. Run setup first.", file=sys.stderr)
        sys.exit(1)
    with open(CONFIG_PATH) as f:
        return json.load(f)

def get_active_games(config):
    """Get games where it's our turn."""
    headers = {"X-API-Key": config["api_key"]}
    url = f"{config['api_url']}/api/games/active"
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json().get("games", [])
    except Exception as e:
        print(f"Error fetching games: {e}", file=sys.stderr)
        return []

def get_game_state(config, game_id):
    """Get full game state."""
    headers = {"X-API-Key": config["api_key"]}
    url = f"{config['api_url']}/api/games/{game_id}"
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"Error fetching game {game_id}: {e}", file=sys.stderr)
        return None

def make_move(config, game_id, move):
    """Submit a move."""
    headers = {"X-API-Key": config["api_key"], "Content-Type": "application/json"}
    url = f"{config['api_url']}/api/games/{game_id}/move"
    try:
        resp = requests.post(url, headers=headers, json={"move": move}, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"Error making move: {e}", file=sys.stderr)
        return None

def evaluate_position(board):
    """Simple position evaluation."""
    if board.is_checkmate():
        return -10000 if board.turn else 10000
    if board.is_stalemate() or board.is_insufficient_material():
        return 0
    
    piece_values = {
        chess.PAWN: 100,
        chess.KNIGHT: 320,
        chess.BISHOP: 330,
        chess.ROOK: 500,
        chess.QUEEN: 900,
        chess.KING: 0
    }
    
    score = 0
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            value = piece_values[piece.piece_type]
            if piece.color == chess.WHITE:
                score += value
            else:
                score -= value
    
    # Bonus for center control
    center = [chess.E4, chess.D4, chess.E5, chess.D5]
    for sq in center:
        if board.is_attacked_by(chess.WHITE, sq):
            score += 10
        if board.is_attacked_by(chess.BLACK, sq):
            score -= 10
    
    return score if board.turn == chess.WHITE else -score

def choose_move(board):
    """Choose best move using simple evaluation."""
    legal_moves = list(board.legal_moves)
    if not legal_moves:
        return None
    
    # Evaluate each move
    best_move = None
    best_score = float('-inf')
    
    for move in legal_moves:
        board.push(move)
        
        # Check for immediate checkmate
        if board.is_checkmate():
            board.pop()
            return board.san(move)
        
        # Simple one-ply evaluation
        score = -evaluate_position(board)
        
        # Bonus for captures
        if board.is_capture(move):
            score += 50
        
        # Bonus for checks
        if board.is_check():
            score += 30
        
        # Bonus for castling
        if board.is_castling(move):
            score += 60
        
        # Small random factor to avoid repetition
        score += random.randint(0, 20)
        
        board.pop()
        
        if score > best_score:
            best_score = score
            best_move = move
    
    return board.san(best_move) if best_move else None

def play_games(config):
    """Check all active games and make moves where it's our turn."""
    games = get_active_games(config)
    moves_made = 0
    
    for game in games:
        if not game.get("your_turn"):
            continue
        
        game_id = game["game_id"]
        state = get_game_state(config, game_id)
        if not state:
            continue
        
        fen = state["fen"]
        board = chess.Board(fen)
        
        move = choose_move(board)
        if not move:
            print(f"Game {game_id}: No legal moves")
            continue
        
        result = make_move(config, game_id, move)
        if result and result.get("success"):
            print(f"Game {game_id}: Played {move}")
            moves_made += 1
            if result.get("result"):
                print(f"  Game ended: {result['result']}")
        else:
            print(f"Game {game_id}: Failed to play {move}")
    
    return moves_made

def main():
    config = load_config()
    print(f"Playing as: {config['name']}")
    
    moves = play_games(config)
    if moves == 0:
        print("No moves to make (not our turn or no active games)")
    else:
        print(f"Made {moves} move(s)")

if __name__ == "__main__":
    main()
