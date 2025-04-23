#!/usr/bin/env python
import requests
import json
import sys

def test_team_statistics(team_id):
    """Test the team statistics endpoint for a given team ID"""
    url = f"http://localhost:8000/api/statistics/team/{team_id}/"
    print(f"Testing URL: {url}")
    
    try:
        response = requests.get(url)
        status_code = response.status_code
        print(f"Status code: {status_code}")
        
        # Try to parse the response as JSON
        try:
            data = response.json()
            
            # Print summary of response
            if status_code == 200:
                print("Success! Response summary:")
                print(f"  Total matches: {data.get('total_matches', 'N/A')}")
                print(f"  Wins: {data.get('wins', 'N/A')}")
                print(f"  Losses: {data.get('losses', 'N/A')}")
                print(f"  Winrate: {data.get('winrate', 'N/A')}")
                print(f"  Avg team KDA: {data.get('avg_team_kda', 'N/A')}")
                
                # Check if we have player statistics
                player_stats = data.get('player_statistics', [])
                print(f"  Player statistics: {len(player_stats)} players")
                
                # Print more details if verbose
                if len(sys.argv) > 2 and sys.argv[2] == '-v':
                    print(json.dumps(data, indent=2))
            else:
                print("Error response:")
                print(json.dumps(data, indent=2))
                
        except json.JSONDecodeError:
            print("Error: Could not parse response as JSON")
            print(response.text[:200] + "..." if len(response.text) > 200 else response.text)
            
    except requests.exceptions.RequestException as e:
        print(f"Error making request: {e}")

if __name__ == "__main__":
    # Get team ID from command line argument
    if len(sys.argv) > 1:
        team_id = sys.argv[1]
    else:
        team_id = 1  # Default to team ID 1
    
    test_team_statistics(team_id) 