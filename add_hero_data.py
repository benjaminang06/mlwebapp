#!/usr/bin/env python
"""
This script adds sample hero data to existing PlayerMatchStat records.
"""
import os
import sys
import sqlite3
import random

# Database connection
DB_PATH = os.path.join('scrim_stats_backend', 'db.sqlite3')

def add_sample_hero_data(team_id=None):
    """Add sample hero data to existing PlayerMatchStat records"""
    # Sample hero data
    heroes = [
        {'id': 1, 'name': 'Ashe'},
        {'id': 2, 'name': 'Garen'},
        {'id': 3, 'name': 'Ahri'},
        {'id': 4, 'name': 'Lee Sin'},
        {'id': 5, 'name': 'Thresh'},
        {'id': 6, 'name': 'Lucian'},
        {'id': 7, 'name': 'Ezreal'},
        {'id': 8, 'name': 'Jinx'},
        {'id': 9, 'name': 'Teemo'},
        {'id': 10, 'name': 'Yasuo'}
    ]
    
    print(f"Adding hero data to PlayerMatchStat records for {'team ' + str(team_id) if team_id else 'all teams'}")
    
    # Connect to the database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # First, check if we already have a hero table or need to create one
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='api_hero'")
    if not cursor.fetchone():
        print("Creating hero table...")
        cursor.execute("""
        CREATE TABLE api_hero (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(255) NOT NULL,
            description TEXT NULL
        )
        """)
        
        # Insert sample heroes
        for hero in heroes:
            cursor.execute(
                "INSERT INTO api_hero (id, name) VALUES (?, ?)",
                (hero['id'], hero['name'])
            )
        
        print(f"Created {len(heroes)} sample heroes")
    
    # Get existing stats
    where_clause = f"WHERE team_id = {team_id}" if team_id else ""
    cursor.execute(f"SELECT id FROM api_playermatchstat {where_clause}")
    stat_ids = [row[0] for row in cursor.fetchall()]
    
    if not stat_ids:
        print("No player match stats found for the specified team")
        conn.close()
        return
    
    print(f"Found {len(stat_ids)} player match stats")
    
    # Update a random selection of stats with hero data
    update_count = min(len(stat_ids), 20)  # Update up to 20 stats
    stats_to_update = random.sample(stat_ids, update_count)
    
    for stat_id in stats_to_update:
        hero = random.choice(heroes)
        cursor.execute(
            "UPDATE api_playermatchstat SET hero_played_id = ?, hero_name = ? WHERE id = ?",
            (hero['id'], hero['name'], stat_id)
        )
    
    # Commit changes
    conn.commit()
    print(f"Updated {update_count} PlayerMatchStat records with hero data")
    
    # Verify updates
    cursor.execute(f"SELECT COUNT(*) FROM api_playermatchstat WHERE hero_played_id IS NOT NULL {where_clause}")
    updated_count = cursor.fetchone()[0]
    print(f"Total records with hero data: {updated_count}")
    
    # Close connection
    conn.close()

if __name__ == "__main__":
    # Get team ID from command line argument if provided
    team_id = int(sys.argv[1]) if len(sys.argv) > 1 else None
    add_sample_hero_data(team_id) 