# Generated manually

from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_rename_api_draftin_team_id_fc828d_idx_api_draftin_team_id_369373_idx_and_more'),
    ]

    operations = [
        # In SQLite, we need to create new tables and copy the data
        migrations.RunSQL(
            sql='''
            -- Create a new PlayerMatchStat table with nullable hero_played
            CREATE TABLE new_api_playermatchstat (
                stats_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                role_played VARCHAR(50) NULL,
                hero_played VARCHAR(100) NULL,
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
                updated_at DATETIME NOT NULL,
                match_id INTEGER NOT NULL REFERENCES api_match (match_id),
                player_id INTEGER NOT NULL REFERENCES api_player (player_id),
                team_id INTEGER NOT NULL REFERENCES api_team (team_id),
                hero_played_id INTEGER NULL REFERENCES api_hero (id)
            );
            
            -- Copy data
            INSERT INTO new_api_playermatchstat
            SELECT * FROM api_playermatchstat;
            
            -- Drop the old table
            DROP TABLE api_playermatchstat;
            
            -- Rename the new table
            ALTER TABLE new_api_playermatchstat RENAME TO api_playermatchstat;
            
            -- Create a new DraftInfo table with nullable hero field
            CREATE TABLE new_api_draftinfo (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                hero VARCHAR(100) NULL,
                choice_type VARCHAR(4) NOT NULL,
                draft_position INTEGER NOT NULL,
                draft_phase INTEGER NOT NULL,
                ban_phase VARCHAR(15) NOT NULL,
                draft_format VARCHAR(10) NOT NULL,
                role_picked_for VARCHAR(50) NULL,
                strategy_notes TEXT NULL,
                team_side VARCHAR(4) NOT NULL,
                match_id INTEGER NOT NULL REFERENCES api_match (match_id),
                player_id INTEGER NULL REFERENCES api_player (player_id),
                team_id INTEGER NOT NULL REFERENCES api_team (team_id),
                hero_id INTEGER NULL REFERENCES api_hero (id)
            );
            
            -- Copy data
            INSERT INTO new_api_draftinfo
            SELECT * FROM api_draftinfo;
            
            -- Drop the old table
            DROP TABLE api_draftinfo;
            
            -- Rename the new table
            ALTER TABLE new_api_draftinfo RENAME TO api_draftinfo;
            ''',
            reverse_sql='''
            -- No reverse SQL - we can't easily undo this change
            '''
        ),
    ] 