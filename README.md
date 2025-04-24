# The First Step Towards Data-Driven Esports: A Match Results Tracker

A web app that lets Mobile Legends coaches and analysts upload, organize, and analyze scrim and tournament match data in a structured database—transforming messy Excel logs into actionable insights.


---

## 🎯 Problem Statement

- **Lack of data-driven strategy**  
  Many professional Mobile Legends teams still rely on gut feel because match data is scattered across unstructured Excel files, making analytics and ML workflows cumbersome.  
- **Messy, unstructured data**  
  Without a centralized database, coaches struggle to perform statistical analyses or build dashboards from raw logs.

---

## 🚀 Solution

We centralize every scrim and tournament match into a relational database so that coaches can:

- Upload match metadata, opponent info, and detailed player stats in one form.  
- Automatically group games into “scrim sessions” for easy session‐level analytics.  
- View recent matches, team statistics, and leaderboards through an interactive dashboard.

---

## 🔑 Core Features

### 1. Match Upload  
- **Metadata & Opponent Info:** Date/time picker, opponent category (Collegiate/Amateur/Pro), team name & abbreviation, scrim type.  
- **Scrim Grouping:** Autocomplete to link or create “scrim sessions” (e.g., “ADMU vs UST Scrim”) that group multiple games.  
- **Player Statistics Entry:**  
  - Five fixed rows each for “Our Team” and “Enemy Team,” prefilled from previous sessions with override options  
  - Fields: hero played, kills/deaths/assists (raw + computed KDA), damage dealt/taken, turret damage, teamfight participation, gold earned, player notes.  

### 2. Recent Matches  
- **Filterable Views:** Preset (Past Week/Month/3 Months) and custom date ranges; filter by team, opponent type.  
- **Aggregate Summary Cards:** Winrate, win–loss record, and other KPIs at a glance.  
- **Scrim Session Cards:** Expandable cards showing session name, record, date range, and individual games.  
- **Detailed Boxscore:** Side-by-side team stats, metadata header, and linked uploads for any selected match.

### 3. Team & Player Statistics  
- **Team Overview:** Total matches, overall winrate, average KDA, damage/gold metrics—visualized in summary cards or charts.  
- **Player List:** Table of rostered players with winrate, avg. KDA, most-played heroes; clickable for detail.  
- **Player Detail View:**  
  - Recent matches with filters  
  - Hero-specific winrates and KPIs over time  
  - Trend charts for KDA and winrate

---

## 🗄 Database Schema (Summary)

- **teams**(team_id, team_name, category, …)  
- **players**(player_id, team_id, current_ign, role, …)  
- **scrim_groups**(scrim_group_id, name, start_date, end_date, …)  
- **matches**(match_id, scrim_group_id, submitted_by, datetime, type, outcome, …)  
- **player_match_stats**(stats_id, match_id, player_id, hero_played, kills, deaths, assists, computed_kda, …)  
- **file_uploads**(file_id, match_id, file_url, file_type, …)

---

## 🛠 Tech Stack

- **Frontend:** React, Tailwind CSS  
- **Backend:** Django + Django REST Framework, PostgreSQL  
- **Auth:** JWT (DRF Simple JWT) or Django sessions  

---

## 📸 Screenshots

**Landing Page**  
<img width="1437" alt="Landing Page" src="https://github.com/user-attachments/assets/3493f6e7-e962-4bbe-8e5d-86020c0f07d2" />

---

**Match History**  
<img width="1440" alt="Match History" src="https://github.com/user-attachments/assets/59d790c6-d959-48d5-a799-1f2c35990bb3" />

---

**Match Upload Page**  
_A detail here is that the players of each side, along with their roles, are auto-populated based on those saved as the main five, making inputting match results much faster._  
<img width="1432" alt="Match Upload Page 1" src="https://github.com/user-attachments/assets/ebd8342a-63ae-4a93-948e-da95da6b55f7" />  
<img width="1427" alt="Match Upload Page 2" src="https://github.com/user-attachments/assets/1c1ed3c3-548d-403c-aef6-a09f6a16afc5" />

---

**Team Statistics**  
<img width="1439" alt="Team Statistics" src="https://github.com/user-attachments/assets/bb14ddb3-9ae0-443d-aaf7-bad14131c586" />
