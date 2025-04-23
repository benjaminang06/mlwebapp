#!/usr/bin/env python
"""
This script checks the database schema to understand the PlayerMatchStat table.
"""
import os
import sys
import sqlite3

# Database connection
DB_PATH = os.path.join('scrim_stats_backend', 'db.sqlite3')

def check_db_schema():
    """Check the database schema"""
    # Connect to the database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = cursor.fetchall()
    
    print(f"Database tables ({len(tables)}):")
    for table in tables:
        print(f"  {table[0]}")
    
    # Find the PlayerMatchStat table
    playermatchstat_table = None
    for table in tables:
        if 'playermatchstat' in table[0].lower():
            playermatchstat_table = table[0]
            break
    
    if not playermatchstat_table:
        print("PlayerMatchStat table not found!")
        conn.close()
        return
    
    print(f"\nInspecting table: {playermatchstat_table}")
    
    # Get table schema
    cursor.execute(f"PRAGMA table_info({playermatchstat_table})")
    columns = cursor.fetchall()
    
    print(f"Columns ({len(columns)}):")
    for col in columns:
        col_id, name, type_, notnull, default_value, pk = col
        print(f"  {name} ({type_}){' PRIMARY KEY' if pk else ''}{' NOT NULL' if notnull else ''}")
    
    # Check if hero fields exist
    hero_fields = [col for col in columns if 'hero' in col[1].lower()]
    if hero_fields:
        print("\nHero-related fields:")
        for col in hero_fields:
            col_id, name, type_, notnull, default_value, pk = col
            print(f"  {name} ({type_})")
        
        # Check if there's data in the hero fields
        for field in hero_fields:
            field_name = field[1]
            cursor.execute(f"SELECT COUNT(*) FROM {playermatchstat_table} WHERE {field_name} IS NOT NULL")
            count = cursor.fetchone()[0]
            print(f"  Records with {field_name} data: {count}")
    else:
        print("\nNo hero-related fields found in the PlayerMatchStat table!")
    
    # Close connection
    conn.close()

if __name__ == "__main__":
    check_db_schema() 