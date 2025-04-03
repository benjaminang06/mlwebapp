#!/usr/bin/env python
import os
import shutil
import sqlite3

# Get current directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MIGRATIONS_DIR = os.path.join(BASE_DIR, 'api', 'migrations')
DB_PATH = os.path.join(BASE_DIR, 'db.sqlite3')

def reset_migrations():
    print("Resetting migrations...")
    
    # 1. Remove existing migration records from database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM django_migrations WHERE app="api"')
    conn.commit()
    conn.close()
    print("Removed migration records from database")
    
    # 2. Create backup of migrations folder
    if os.path.exists(MIGRATIONS_DIR):
        backup_dir = MIGRATIONS_DIR + '_backup'
        if os.path.exists(backup_dir):
            shutil.rmtree(backup_dir)
        shutil.copytree(MIGRATIONS_DIR, backup_dir)
        print(f"Created backup of migrations at {backup_dir}")
    
    # 3. Remove and recreate migrations folder
    if os.path.exists(MIGRATIONS_DIR):
        shutil.rmtree(MIGRATIONS_DIR)
    os.makedirs(MIGRATIONS_DIR)
    
    # Create empty __init__.py file
    with open(os.path.join(MIGRATIONS_DIR, '__init__.py'), 'w') as f:
        pass
    
    print("Reset complete. You can now run:")
    print("python manage.py makemigrations api")
    print("python manage.py migrate api --fake-initial")

if __name__ == "__main__":
    reset_migrations() 