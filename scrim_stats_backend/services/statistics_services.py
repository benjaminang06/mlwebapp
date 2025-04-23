from django.db.models import Sum, Avg, Count
from api.models import Match, PlayerMatchStat, Team, Player, Hero
import logging
import traceback

# Get logger
logger = logging.getLogger(__name__)

class StatisticsService:
    @staticmethod
    def calculate_team_statistics(team_id):
        """
        Calculate comprehensive statistics for a team
        
        Args:
            team_id: The ID of the team to calculate statistics for
            
        Returns:
            Dictionary containing team statistics or None if team not found
        """
        try:
            logger.info(f"Calculating statistics for team ID: {team_id}")
            
            try:
                team = Team.objects.get(pk=team_id)
                logger.info(f"Found team: {team.team_name}")
            except Team.DoesNotExist:
                logger.warning(f"Team with ID {team_id} not found")
                return None
                
            # Get matches involving this team
            try:
                blue_side_matches = Match.objects.filter(blue_side_team_id=team_id)
                red_side_matches = Match.objects.filter(red_side_team_id=team_id)
                
                # First check if either query returned results
                logger.info(f"Found {blue_side_matches.count()} blue side matches and {red_side_matches.count()} red side matches")
                
                # Combine them with select_related
                matches = (blue_side_matches | red_side_matches).select_related('blue_side_team', 'red_side_team')
            except Exception as e:
                logger.error(f"Error fetching matches: {str(e)}")
                logger.error(traceback.format_exc())
                matches = []
            
            if not matches:
                logger.warning(f"No matches found for team {team_id}")
                # Return basic team info without match statistics
                return {
                    'total_matches': 0,
                    'wins': 0,
                    'losses': 0,
                    'winrate': 0,
                    'avg_match_duration': '00:00:00',
                    'avg_team_kda': 0,
                    'avg_kills_per_match': 0,
                    'avg_deaths_per_match': 0,
                    'avg_assists_per_match': 0,
                    'hero_pick_frequency': [],
                    'damage_distribution': [],
                    'gold_distribution': [],
                    'vision_distribution': [],
                    'objective_control_rate': 0,
                    'player_statistics': [],
                    'recent_matches': [],
                    'performance_trend': []
                }
            
            # Basic match statistics
            total_matches = matches.count()
            wins = matches.filter(winning_team_id=team_id).count()
            losses = total_matches - wins
            
            logger.info(f"Team stats: {total_matches} matches, {wins} wins, {losses} losses")
            
            # Calculate win rate
            winrate = (wins / total_matches * 100) if total_matches > 0 else 0
            
            # Calculate average match duration
            matches_with_duration = [m for m in matches if m.match_duration]
            if matches_with_duration:
                total_seconds = 0
                for match in matches_with_duration:
                    try:
                        parts = match.match_duration.split(':')
                        if len(parts) == 3:  # Format: HH:MM:SS
                            hours, minutes, seconds = map(int, parts)
                            total_seconds += hours * 3600 + minutes * 60 + seconds
                    except (ValueError, AttributeError) as e:
                        logger.warning(f"Error parsing match duration for match {match.match_id}: {str(e)}")
                        continue
                        
                avg_seconds = total_seconds // len(matches_with_duration)
                avg_hours = avg_seconds // 3600
                avg_minutes = (avg_seconds % 3600) // 60
                avg_seconds_remainder = avg_seconds % 60
                avg_duration = f"{avg_hours:02d}:{avg_minutes:02d}:{avg_seconds_remainder:02d}"
            else:
                avg_duration = "00:00:00"
            
            # Get player stats for this team
            try:
                player_stats = PlayerMatchStat.objects.filter(
                    team_id=team_id,
                    match__in=matches
                )
                # Note: We removed select_related to avoid potential issues with relationships
                
                logger.info(f"Found {player_stats.count()} player stat records")
                
                # Debug: Print first player stat record to inspect structure
                if player_stats.exists():
                    first_stat = player_stats.first()
                    logger.info(f"First stat record fields:")
                    for field in first_stat._meta.fields:
                        field_name = field.name
                        field_value = getattr(first_stat, field_name, None)
                        logger.info(f"  {field_name}: {field_value}")
            except Exception as e:
                logger.error(f"Error fetching player stats: {str(e)}")
                logger.error(traceback.format_exc())
                player_stats = []
            
            # Calculate team KDA
            try:
                kill_agg = player_stats.aggregate(Sum('kills'))
                death_agg = player_stats.aggregate(Sum('deaths'))
                assist_agg = player_stats.aggregate(Sum('assists'))
                
                total_kills = kill_agg['kills__sum'] or 0
                total_deaths = death_agg['deaths__sum'] or 0
                total_assists = assist_agg['assists__sum'] or 0
                
                logger.info(f"Team KDA: {total_kills}/{total_deaths}/{total_assists}")
                
                avg_team_kda = (total_kills + total_assists) / total_deaths if total_deaths > 0 else total_kills + total_assists
            except Exception as e:
                logger.error(f"Error calculating team KDA: {str(e)}")
                logger.error(traceback.format_exc())
                total_kills = total_deaths = total_assists = 0
                avg_team_kda = 0
            
            # Calculate player-specific statistics
            player_statistics = []
            
            try:
                # Safely get player_ids
                player_ids_queryset = player_stats.values_list('player_id', flat=True).distinct()
                player_ids = [pid for pid in player_ids_queryset if pid is not None]
                
                logger.info(f"Found {len(player_ids)} unique players with valid IDs")
                
                # Hero pick frequency
                hero_pick_frequency = []
                try:
                    hero_pick_counts = {}
                    
                    # Collect all hero picks from player match stats
                    for stat in player_stats:
                        if stat.hero_played:
                            # Handle different formats of hero_played
                            if isinstance(stat.hero_played, Hero):
                                hero_id = stat.hero_played.id
                                hero_name = stat.hero_played.name
                            elif isinstance(stat.hero_played, int):
                                hero_id = stat.hero_played
                                hero_name = stat.hero_name or f"Hero {hero_id}"
                            else:
                                # Try to extract id and name
                                try:
                                    hero_id = getattr(stat.hero_played, 'id', stat.hero_played)
                                    hero_name = getattr(stat.hero_played, 'name', stat.hero_name or f"Hero {hero_id}")
                                except:
                                    logger.warning(f"Could not extract hero data from {stat.hero_played}")
                                    continue
                            
                            if hero_id not in hero_pick_counts:
                                hero_pick_counts[hero_id] = {
                                    'hero_id': hero_id,
                                    'hero_name': hero_name,
                                    'picks': 0,
                                    'wins': 0
                                }
                            
                            hero_pick_counts[hero_id]['picks'] += 1
                            
                            # Check if this was a win
                            match = stat.match
                            if match and match.winning_team_id == team_id:
                                hero_pick_counts[hero_id]['wins'] += 1
                
                    # Convert to the expected format and calculate winrates
                    for hero_data in hero_pick_counts.values():
                        picks = hero_data['picks']
                        wins = hero_data['wins']
                        hero_pick_frequency.append({
                            'hero_id': hero_data['hero_id'],
                            'hero_name': hero_data['hero_name'],
                            'picks': picks,
                            'wins': wins,
                            'winrate': (wins / picks) * 100 if picks > 0 else 0
                        })
                    
                    # Sort by pick count and limit to top 10
                    hero_pick_frequency.sort(key=lambda x: x['picks'], reverse=True)
                    hero_pick_frequency = hero_pick_frequency[:10]
                    
                    logger.info(f"Found {len(hero_pick_frequency)} heroes played by team")
                except Exception as e:
                    logger.error(f"Error calculating hero pick frequency: {str(e)}")
                    logger.error(traceback.format_exc())
                    # Ensure we at least have an empty list
                    hero_pick_frequency = []
                
                # Process players
                for player_id in player_ids:
                    try:
                        player = Player.objects.get(pk=player_id)
                        logger.info(f"Processing stats for player: {player.current_ign}")
                        
                        player_match_stats = player_stats.filter(player_id=player_id)
                        
                        # Count matches for this player
                        player_match_ids = player_match_stats.values_list('match_id', flat=True).distinct()
                        player_matches = len(player_match_ids)
                        
                        # Calculate player wins
                        player_wins = 0
                        for match_id in player_match_ids:
                            match = next((m for m in matches if m.match_id == match_id), None)
                            if match and match.winning_team_id == team_id:
                                player_wins += 1
                                
                        # Calculate player KDA
                        player_kills = player_match_stats.aggregate(Sum('kills'))['kills__sum'] or 0
                        player_deaths = player_match_stats.aggregate(Sum('deaths'))['deaths__sum'] or 0
                        player_assists = player_match_stats.aggregate(Sum('assists'))['assists__sum'] or 0
                        
                        avg_kda = (player_kills + player_assists) / player_deaths if player_deaths > 0 else player_kills + player_assists
                        
                        # Calculate player damage and gold
                        player_damage = player_match_stats.aggregate(Sum('damage_dealt'))['damage_dealt__sum'] or 0
                        player_gold = player_match_stats.aggregate(Sum('gold_earned'))['gold_earned__sum'] or 0
                        player_vision = player_match_stats.aggregate(Sum('teamfight_participation'))['teamfight_participation__sum'] or 0
                        
                        # Count stats for averaging
                        damage_stats_count = player_match_stats.exclude(damage_dealt=None).count() or 1
                        gold_stats_count = player_match_stats.exclude(gold_earned=None).count() or 1
                        vision_stats_count = player_match_stats.exclude(teamfight_participation=None).count() or 1
                        
                        # Add player stats to results
                        player_statistics.append({
                            'player': {
                                'player_id': player.player_id,
                                'current_ign': player.current_ign,
                                'primary_role': player.primary_role
                            },
                            'total_matches': player_matches,
                            'wins': player_wins,
                            'losses': player_matches - player_wins,
                            'winrate': (player_wins / player_matches * 100) if player_matches > 0 else 0,
                            'avg_kda': avg_kda,
                            'avg_kills': player_kills / player_matches if player_matches > 0 else 0,
                            'avg_deaths': player_deaths / player_matches if player_matches > 0 else 0,
                            'avg_assists': player_assists / player_matches if player_matches > 0 else 0,
                            'avg_damage_dealt': player_damage / damage_stats_count,
                            'avg_gold_earned': player_gold / gold_stats_count,
                            'avg_vision_score': player_vision / vision_stats_count,
                            'favorite_heroes': []
                        })
                    except Player.DoesNotExist:
                        logger.warning(f"Player with ID {player_id} not found")
                        continue
                    except Exception as e:
                        logger.error(f"Error processing player {player_id}: {str(e)}")
                        logger.error(traceback.format_exc())
                        continue
            except Exception as e:
                logger.error(f"Error fetching player IDs: {str(e)}")
                logger.error(traceback.format_exc())
                player_ids = []
            
            # Prepare damage distribution data
            damage_distribution = []
            gold_distribution = []
            vision_distribution = []
            
            # Extract total values for percentage calculations
            total_damage = sum(ps['avg_damage_dealt'] for ps in player_statistics if 'avg_damage_dealt' in ps)
            total_gold = sum(ps['avg_gold_earned'] for ps in player_statistics if 'avg_gold_earned' in ps)
            total_vision = sum(ps['avg_vision_score'] for ps in player_statistics if 'avg_vision_score' in ps)
            
            for ps in player_statistics:
                if 'avg_damage_dealt' in ps and total_damage > 0:
                    damage_distribution.append({
                        'player_id': ps['player']['player_id'],
                        'player_name': ps['player']['current_ign'],
                        'average_value': ps['avg_damage_dealt'],
                        'percentage': (ps['avg_damage_dealt'] / total_damage * 100) if total_damage > 0 else 0
                    })
                    
                if 'avg_gold_earned' in ps and total_gold > 0:
                    gold_distribution.append({
                        'player_id': ps['player']['player_id'],
                        'player_name': ps['player']['current_ign'],
                        'average_value': ps['avg_gold_earned'],
                        'percentage': (ps['avg_gold_earned'] / total_gold * 100) if total_gold > 0 else 0
                    })
                    
                if 'avg_vision_score' in ps and total_vision > 0:
                    vision_distribution.append({
                        'player_id': ps['player']['player_id'],
                        'player_name': ps['player']['current_ign'],
                        'average_value': ps['avg_vision_score'],
                        'percentage': (ps['avg_vision_score'] / total_vision * 100) if total_vision > 0 else 0
                    })
            
            # Sort distributions by percentage
            damage_distribution.sort(key=lambda x: x['percentage'], reverse=True)
            gold_distribution.sort(key=lambda x: x['percentage'], reverse=True)
            vision_distribution.sort(key=lambda x: x['percentage'], reverse=True)
            
            # Get recent matches - most recent 5 matches
            recent_matches = []
            for match in sorted(matches, key=lambda m: m.match_date, reverse=True)[:5]:
                match_data = {
                    'match_id': match.match_id,
                    'match_date': match.match_date,
                    'scrim_type': match.scrim_type,
                    'match_outcome': 'VICTORY' if match.winning_team_id == team_id else 'DEFEAT',
                    'our_team_details': {
                        'team_id': team.team_id,
                        'team_name': team.team_name,
                        'team_abbreviation': team.team_abbreviation
                    },
                    'blue_side_team_details': {
                        'team_id': match.blue_side_team.team_id,
                        'team_name': match.blue_side_team.team_name,
                        'team_abbreviation': match.blue_side_team.team_abbreviation
                    } if match.blue_side_team else None,
                    'red_side_team_details': {
                        'team_id': match.red_side_team.team_id,
                        'team_name': match.red_side_team.team_name,
                        'team_abbreviation': match.red_side_team.team_abbreviation
                    } if match.red_side_team else None
                }
                recent_matches.append(match_data)
            
            # Performance trend
            performance_trend = []
            for match in sorted(matches, key=lambda m: m.match_date)[:10]:  # Last 10 matches by date
                # Get opponent team
                if match.blue_side_team_id == team_id:
                    opponent = match.red_side_team
                else:
                    opponent = match.blue_side_team
                
                # Get match stats
                match_player_stats = player_stats.filter(match_id=match.match_id)
                match_kills = match_player_stats.aggregate(Sum('kills'))['kills__sum'] or 0
                match_deaths = match_player_stats.aggregate(Sum('deaths'))['deaths__sum'] or 0
                match_assists = match_player_stats.aggregate(Sum('assists'))['assists__sum'] or 0
                match_kda = (match_kills + match_assists) / match_deaths if match_deaths > 0 else match_kills + match_assists
                
                trend_data = {
                    'date': match.match_date,
                    'opponent': opponent.team_name if opponent else 'Unknown',
                    'won': match.winning_team_id == team_id,
                    'kda': match_kda
                }
                performance_trend.append(trend_data)
            
            # Return complete team statistics
            return {
                'total_matches': total_matches,
                'wins': wins,
                'losses': losses,
                'winrate': winrate,
                'avg_match_duration': avg_duration,
                'avg_team_kda': avg_team_kda,
                'avg_kills_per_match': total_kills / total_matches if total_matches > 0 else 0,
                'avg_deaths_per_match': total_deaths / total_matches if total_matches > 0 else 0,
                'avg_assists_per_match': total_assists / total_matches if total_matches > 0 else 0,
                'hero_pick_frequency': hero_pick_frequency or [],
                'damage_distribution': damage_distribution or [],
                'gold_distribution': gold_distribution or [],
                'vision_distribution': vision_distribution or [],
                'objective_control_rate': 0,  # This would require additional data
                'player_statistics': player_statistics or [],
                'recent_matches': recent_matches or [],
                'performance_trend': performance_trend or []
            }
            
        except Exception as e:
            logger.error(f"Unhandled exception in calculate_team_statistics: {str(e)}")
            logger.error(traceback.format_exc())
            # Return a minimal valid response to prevent 500 errors
            return {
                'total_matches': 0,
                'wins': 0,
                'losses': 0,
                'winrate': 0,
                'hero_pick_frequency': [],
                'damage_distribution': [],
                'gold_distribution': [],
                'vision_distribution': [],
                'objective_control_rate': 0,
                'player_statistics': [],
                'recent_matches': [],
                'performance_trend': [],
                'error': str(e),
                'message': 'An error occurred while calculating statistics'
            } 