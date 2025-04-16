#!/usr/bin/env python
"""
This script fixes the database schema directly using SQL
to resolve migration issues for the PlayMatchStat model.
"""

import os
import django
import sqlite3

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scrim_stats_backend.settings')
django.setup()

# Get the database path from Django settings
from django.conf import settings
db_path = settings.DATABASES['default']['NAME']

print(f"Fixing database at: {db_path}")

# Connect to the database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Check if the column exists already
    cursor.execute("PRAGMA table_info(api_playermatchstat)")
    columns = [col[1] for col in cursor.fetchall()]
    
    # Determine what operations we need
    if 'hero_played' in columns and 'hero_played_id' not in columns:
        print("Converting hero_played to hero_played_id...")
        
        # First, make the hero_played column nullable
        cursor.execute("ALTER TABLE api_playermatchstat RENAME TO api_playermatchstat_old")
        
        # Create a new table with the correct schema
        cursor.execute("""
        CREATE TABLE api_playermatchstat (
            stats_id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER NOT NULL REFERENCES api_match(match_id),
            player_id INTEGER NOT NULL REFERENCES api_player(player_id),
            team_id INTEGER NOT NULL REFERENCES api_team(team_id),
            role_played VARCHAR(50) NULL,
            hero_played_id INTEGER NULL REFERENCES api_hero(id),
            kills INTEGER NOT NULL,
            deaths INTEGER NOT NULL,
            assists INTEGER NOT NULL,
            computed_kda REAL NOT NULL,
            damage_dealt INTEGER NULL,
            damage_taken INTEGER NULL,
            turret_damage INTEGER NULL,
            teamfight_participation REAL NULL,
            gold_earned INTEGER NULL,
            player_notes TEXT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
        )
        """)
        
        # Copy data from old table to new, setting hero_played_id to NULL
        cursor.execute("""
        INSERT INTO api_playermatchstat (
            stats_id, match_id, player_id, team_id, role_played,
            hero_played_id, kills, deaths, assists, computed_kda,
            damage_dealt, damage_taken, turret_damage, 
            teamfight_participation, gold_earned, player_notes,
            created_at, updated_at
        )
        SELECT 
            stats_id, match_id, player_id, team_id, role_played,
            NULL, kills, deaths, assists, computed_kda,
            damage_dealt, damage_taken, turret_damage, 
            teamfight_participation, gold_earned, player_notes,
            created_at, updated_at
        FROM api_playermatchstat_old
        """)
        
        # Drop the old table
        cursor.execute("DROP TABLE api_playermatchstat_old")
        
        print("Table structure updated successfully")
    elif 'hero_played_id' in columns:
        print("Database schema appears to already be updated.")
    else:
        print("Unexpected schema - could not determine appropriate action.")
    
    # Mark migrations as applied
    cursor.execute("""
        INSERT OR IGNORE INTO django_migrations (app, name, applied)
        VALUES ('api', '0014_alter_playermatchstat_hero_played_and_more', datetime('now'))
    """)
    
    conn.commit()
    print("Migration marked as applied in django_migrations table")
    
except Exception as e:
    conn.rollback()
    print(f"Error: {e}")
finally:
    conn.close()

print("Script completed. You should now be able to run migrations normally.") 