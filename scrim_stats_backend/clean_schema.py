#!/usr/bin/env python
import os
import sys
import sqlite3

# Setup path
base_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(base_dir, 'db.sqlite3')

def clean_schema():
    """Prepare the database schema for a clean migration"""
    print(f"Connecting to database at {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Turn off foreign key constraints
        cursor.execute('PRAGMA foreign_keys = OFF;')
        
        # 1. First, backup existing hero data from the relevant fields
        print("Backing up hero data...")
        cursor.execute("SELECT stats_id, hero_played FROM api_playermatchstat WHERE hero_played IS NOT NULL")
        player_hero_data = cursor.fetchall()
        print(f"Found {len(player_hero_data)} player-hero records")
        
        cursor.execute("SELECT id, hero FROM api_draftinfo WHERE hero IS NOT NULL")
        draft_hero_data = cursor.fetchall()
        print(f"Found {len(draft_hero_data)} draft-hero records")
        
        # 2. Check for foreign key columns and remove them if they exist
        print("Checking and removing existing foreign key columns...")
        
        # Get schema info for PlayerMatchStat
        cursor.execute("PRAGMA table_info(api_playermatchstat)")
        playermatchstat_columns = [row[1] for row in cursor.fetchall()]
        
        # Get schema info for DraftInfo
        cursor.execute("PRAGMA table_info(api_draftinfo)")
        draftinfo_columns = [row[1] for row in cursor.fetchall()]
        
        # Remove hero_played_id column if it exists
        if 'hero_played_id' in playermatchstat_columns:
            print("Removing hero_played_id column from api_playermatchstat")
            # SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
            # First, get the full schema
            cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='api_playermatchstat'")
            create_table_sql = cursor.fetchone()[0]
            
            # Create a temporary table with the same schema but without the hero_played_id column
            temp_create_sql = create_table_sql.replace(
                ', hero_played_id INTEGER REFERENCES api_hero(id)', ''
            ).replace(
                ',hero_played_id INTEGER REFERENCES api_hero(id)', ''
            ).replace('api_playermatchstat', 'api_playermatchstat_temp')
            
            cursor.execute(temp_create_sql)
            
            # Copy all data except the hero_played_id column
            columns_to_copy = [col for col in playermatchstat_columns if col != 'hero_played_id']
            columns_sql = ', '.join(columns_to_copy)
            cursor.execute(f"INSERT INTO api_playermatchstat_temp SELECT {columns_sql} FROM api_playermatchstat")
            
            # Drop the original table
            cursor.execute("DROP TABLE api_playermatchstat")
            
            # Rename the temporary table
            cursor.execute("ALTER TABLE api_playermatchstat_temp RENAME TO api_playermatchstat")
            
            print("Recreated api_playermatchstat table without hero_played_id column")
        
        # Remove hero_id column if it exists
        if 'hero_id' in draftinfo_columns:
            print("Removing hero_id column from api_draftinfo")
            # Same approach as above
            cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='api_draftinfo'")
            create_table_sql = cursor.fetchone()[0]
            
            temp_create_sql = create_table_sql.replace(
                ', hero_id INTEGER REFERENCES api_hero(id)', ''
            ).replace(
                ',hero_id INTEGER REFERENCES api_hero(id)', ''
            ).replace('api_draftinfo', 'api_draftinfo_temp')
            
            cursor.execute(temp_create_sql)
            
            columns_to_copy = [col for col in draftinfo_columns if col != 'hero_id']
            columns_sql = ', '.join(columns_to_copy)
            cursor.execute(f"INSERT INTO api_draftinfo_temp SELECT {columns_sql} FROM api_draftinfo")
            
            cursor.execute("DROP TABLE api_draftinfo")
            cursor.execute("ALTER TABLE api_draftinfo_temp RENAME TO api_draftinfo")
            
            print("Recreated api_draftinfo table without hero_id column")
        
        # 3. Reset migration state in django_migrations table
        cursor.execute("DELETE FROM django_migrations WHERE app='api' AND name IN ('0003_convert_heroes_to_fk', '0004_populate_hero_relations', '0005_fix_hero_references')")
        print("Cleaned up migration records")
        
        # 4. Check Hero table for any inconsistencies
        cursor.execute("SELECT id, name FROM api_hero")
        heroes = {row[1]: row[0] for row in cursor.fetchall()}
        print(f"Found {len(heroes)} heroes in the database")
        
        # Find heroes referenced in stats but not in the Hero table
        missing_heroes = []
        for _, hero_name in player_hero_data:
            if hero_name and hero_name not in heroes:
                missing_heroes.append(hero_name)
        
        for _, hero_name in draft_hero_data:
            if hero_name and hero_name not in heroes:
                missing_heroes.append(hero_name)
        
        # Create any missing heroes
        for hero_name in set(missing_heroes):
            print(f"Creating missing hero: {hero_name}")
            cursor.execute(
                "INSERT INTO api_hero (name, role, released_date) VALUES (?, 'Unknown', '2016-01-01')",
                (hero_name,)
            )
        
        # Save changes
        conn.commit()
        print("Schema preparation complete.")
        print("\nYou can now run migrations with:")
        print("python manage.py makemigrations api")
        print("python manage.py migrate")
    
    except Exception as e:
        conn.rollback()
        print(f"Error during schema preparation: {e}")
    
    finally:
        conn.close()

if __name__ == "__main__":
    clean_schema() 