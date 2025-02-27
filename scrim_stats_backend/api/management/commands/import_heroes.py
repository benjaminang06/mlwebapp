from django.core.management.base import BaseCommand
from api.models import Hero
from django.utils import timezone
import datetime

class Command(BaseCommand):
    help = 'Import heroes into the database'

    def handle(self, *args, **kwargs):
        # Clear existing heroes if needed
        # Hero.objects.all().delete()
        
        heroes = [
            {"name": "Miya", "role": "Marksman", "released_date": "2016-01-01"},
            {"name": "Balmond", "role": "Fighter", "released_date": "2016-01-01"},
            {"name": "Saber", "role": "Assassin", "released_date": "2016-01-01"},
            {"name": "Alice", "role": "Mage/Tank", "released_date": "2016-01-01"},
            {"name": "Nana", "role": "Mage", "released_date": "2016-01-01"},
            {"name": "Tigreal", "role": "Tank", "released_date": "2016-01-01"},
            {"name": "Alucard", "role": "Fighter/Assassin", "released_date": "2016-01-01"},
            {"name": "Karina", "role": "Assassin", "released_date": "2016-01-01"},
            {"name": "Akai", "role": "Tank", "released_date": "2016-01-01"},
            {"name": "Franco", "role": "Tank", "released_date": "2016-01-01"},
            {"name": "Bane", "role": "Fighter/Mage", "released_date": "2016-01-01"},
            {"name": "Bruno", "role": "Marksman", "released_date": "2016-01-01"},
            {"name": "Clint", "role": "Marksman", "released_date": "2016-01-01"},
            {"name": "Rafaela", "role": "Support", "released_date": "2016-01-01"},
            {"name": "Eudora", "role": "Mage", "released_date": "2016-01-01"},
            {"name": "Zilong", "role": "Fighter/Assassin", "released_date": "2016-09-09"},
            {"name": "Fanny", "role": "Assassin", "released_date": "2016-09-30"},
            {"name": "Layla", "role": "Marksman", "released_date": "2016-09-23"},
            {"name": "Minotaur", "role": "Tank/Support", "released_date": "2016-10-14"},
            {"name": "Lolita", "role": "Support/Tank", "released_date": "2016-10-28"},
            {"name": "Hayabusa", "role": "Assassin", "released_date": "2016-11-04"},
            {"name": "Freya", "role": "Fighter", "released_date": "2016-11-01"},
            {"name": "Gord", "role": "Mage", "released_date": "2016-11-01"},
            {"name": "Natalia", "role": "Assassin", "released_date": "2016-12-01"},
            {"name": "Kagura", "role": "Mage", "released_date": "2016-12-01"},
            {"name": "Chou", "role": "Fighter", "released_date": "2016-12-01"},
            {"name": "Sun", "role": "Fighter", "released_date": "2016-12-01"},
            {"name": "Alpha", "role": "Fighter", "released_date": "2017-01-01"},
            {"name": "Ruby", "role": "Fighter", "released_date": "2017-01-01"},
            {"name": "Yi Sun-shin", "role": "Assassin/Marksman", "released_date": "2017-01-01"},
            {"name": "Moskov", "role": "Marksman", "released_date": "2017-02-01"},
            {"name": "Johnson", "role": "Tank/Support", "released_date": "2017-03-14"},
            {"name": "Cyclops", "role": "Mage", "released_date": "2017-04-01"},
            {"name": "Estes", "role": "Support", "released_date": "2017-04-01"},
            {"name": "Hilda", "role": "Fighter/Tank", "released_date": "2017-04-01"},
            {"name": "Aurora", "role": "Mage", "released_date": "2017-05-01"},
            {"name": "Lapu-Lapu", "role": "Fighter", "released_date": "2017-05-01"},
            {"name": "Vexana", "role": "Mage", "released_date": "2017-05-01"},
            {"name": "Roger", "role": "Fighter/Marksman", "released_date": "2017-06-25"},
            {"name": "Karrie", "role": "Marksman", "released_date": "2017-07-01"},
            {"name": "Gatotkaca", "role": "Tank/Fighter", "released_date": "2017-07-01"},
            {"name": "Harley", "role": "Assassin/Mage", "released_date": "2017-07-29"},
            {"name": "Irithel", "role": "Marksman", "released_date": "2017-08-01"},
            {"name": "Grock", "role": "Tank/Fighter", "released_date": "2017-08-01"},
            {"name": "Argus", "role": "Fighter", "released_date": "2017-09-01"},
            {"name": "Odette", "role": "Mage", "released_date": "2017-09-29"},
            {"name": "Lancelot", "role": "Assassin", "released_date": "2017-10-01"},
            {"name": "Diggie", "role": "Support", "released_date": "2017-11-19"},
            {"name": "Hylos", "role": "Tank", "released_date": "2017-11-01"},
            {"name": "Zhask", "role": "Mage", "released_date": "2017-11-01"},
            {"name": "Helcurt", "role": "Assassin", "released_date": "2017-12-01"},
            {"name": "Pharsa", "role": "Mage", "released_date": "2017-12-27"},
            {"name": "Lesley", "role": "Marksman/Assassin", "released_date": "2018-01-01"},
            {"name": "Jawhead", "role": "Fighter", "released_date": "2018-01-01"},
            {"name": "Angela", "role": "Support", "released_date": "2018-02-06"},
            {"name": "Gusion", "role": "Assassin", "released_date": "2018-02-01"},
            {"name": "Valir", "role": "Mage", "released_date": "2018-03-01"},
            {"name": "Martis", "role": "Fighter", "released_date": "2018-03-01"},
            {"name": "Uranus", "role": "Tank", "released_date": "2018-04-01"},
            {"name": "Hanabi", "role": "Marksman", "released_date": "2018-04-17"},
            {"name": "Chang'e", "role": "Mage", "released_date": "2018-05-30"},
            {"name": "Kaja", "role": "Support/Fighter", "released_date": "2018-04-25"},
            {"name": "Selena", "role": "Assassin/Mage", "released_date": "2018-07-10"},
            {"name": "Aldous", "role": "Fighter", "released_date": "2018-07-24"},
            {"name": "Claude", "role": "Marksman", "released_date": "2018-08-07"},
            {"name": "Vale", "role": "Mage", "released_date": "2019-01-29"},
            {"name": "Leomord", "role": "Fighter", "released_date": "2018-08-01"},
            {"name": "Lunox", "role": "Mage", "released_date": "2018-09-01"},
            {"name": "Hanzo", "role": "Assassin", "released_date": "2018-12-04"},
            {"name": "Belerick", "role": "Tank", "released_date": "2018-08-17"},
            {"name": "Kimmy", "role": "Marksman/Mage", "released_date": "2018-10-01"},
            {"name": "Thamuz", "role": "Fighter", "released_date": "2018-10-01"},
            {"name": "Harith", "role": "Mage", "released_date": "2018-11-01"},
            {"name": "Minsitthar", "role": "Fighter", "released_date": "2018-11-01"},
            {"name": "Kadita", "role": "Mage/Assassin", "released_date": "2018-12-18"},
            # Adding more heroes
            {"name": "Faramis", "role": "Support/Mage", "released_date": "2019-05-18"},
            {"name": "Badang", "role": "Fighter", "released_date": "2019-01-15"},
            {"name": "Khufra", "role": "Tank", "released_date": "2019-03-12"},
            {"name": "Granger", "role": "Marksman", "released_date": "2019-04-23"},
            {"name": "Guinevere", "role": "Fighter", "released_date": "2019-02-21"},
            {"name": "Esmeralda", "role": "Tank/Mage", "released_date": "2019-04-03"},
            {"name": "Terizla", "role": "Fighter/Tank", "released_date": "2019-06-04"},
            {"name": "X.Borg", "role": "Fighter", "released_date": "2019-08-09"},
            {"name": "Ling", "role": "Assassin", "released_date": "2019-11-24"},
            {"name": "Dyrroth", "role": "Fighter", "released_date": "2019-06-25"},
            {"name": "Lylia", "role": "Mage", "released_date": "2019-07-23"},
            {"name": "Baxia", "role": "Tank", "released_date": "2019-10-08"},
            {"name": "Masha", "role": "Fighter/Tank", "released_date": "2019-09-17"},
            {"name": "Wanwan", "role": "Marksman", "released_date": "2019-11-26"},
            {"name": "Silvanna", "role": "Fighter", "released_date": "2019-12-17"},
            {"name": "Cecilion", "role": "Mage", "released_date": "2020-02-12"},
            {"name": "Carmilla", "role": "Support/Tank", "released_date": "2020-01-17"},
            {"name": "Atlas", "role": "Tank", "released_date": "2020-03-20"},
            {"name": "Popol and Kupa", "role": "Marksman", "released_date": "2020-04-21"},
            {"name": "Yu Zhong", "role": "Fighter", "released_date": "2020-06-01"},
            {"name": "Luo Yi", "role": "Mage", "released_date": "2020-05-16"},
            {"name": "Benedetta", "role": "Assassin/Fighter", "released_date": "2020-11-07"},
            {"name": "Khaleed", "role": "Fighter", "released_date": "2020-08-07"},
            {"name": "Barats", "role": "Tank/Fighter", "released_date": "2020-09-18"},
            {"name": "Brody", "role": "Marksman", "released_date": "2020-10-16"},
            {"name": "Yve", "role": "Mage", "released_date": "2021-02-12"},
            {"name": "Mathilda", "role": "Support/Assassin", "released_date": "2020-12-12"},
            {"name": "Paquito", "role": "Fighter/Assassin", "released_date": "2021-01-15"},
            {"name": "Gloo", "role": "Tank", "released_date": "2021-04-16"},
            {"name": "Beatrix", "role": "Marksman", "released_date": "2021-03-19"},
            {"name": "Phoveus", "role": "Fighter", "released_date": "2021-05-11"},
            {"name": "Natan", "role": "Marksman", "released_date": "2021-07-23"},
            {"name": "Aulus", "role": "Fighter", "released_date": "2021-08-31"},
            {"name": "Aamon", "role": "Assassin", "released_date": "2021-10-25"},
            {"name": "Valentina", "role": "Mage", "released_date": "2021-11-25"},
            {"name": "Edith", "role": "Tank/Marksman", "released_date": "2021-12-24"},
            {"name": "Floryn", "role": "Support", "released_date": "2021-09-22"},
            {"name": "Yin", "role": "Fighter/Assassin", "released_date": "2022-01-18"},
            {"name": "Melissa", "role": "Marksman", "released_date": "2022-02-22"},
            {"name": "Xavier", "role": "Mage", "released_date": "2022-03-22"},
            {"name": "Julian", "role": "Fighter/Mage", "released_date": "2022-05-24"},
            {"name": "Fredrinn", "role": "Fighter/Tank", "released_date": "2022-08-12"},
            {"name": "Joy", "role": "Assassin", "released_date": "2022-11-18"},
            {"name": "Novaria", "role": "Mage", "released_date": "2023-05-16"},
            {"name": "Arlott", "role": "Fighter/Assassin", "released_date": "2023-02-14"},
            {"name": "Ixia", "role": "Marksman", "released_date": "2023-07-08"},
            {"name": "Nolan", "role": "Assassin", "released_date": "2023-09-30"},
            {"name": "Cici", "role": "Fighter", "released_date": "2023-12-27"},
            {"name": "Chip", "role": "Support/Tank", "released_date": "2024-03-16"},
            {"name": "Zhuxin", "role": "Mage", "released_date": "2024-06-29"},
            {"name": "Suyou", "role": "Assassin/Fighter", "released_date": "2024-09-21"},
            {"name": "Lukas", "role": "Fighter", "released_date": "2024-12-21"}
        ]
        
        # Create heroes
        created_count = 0
        for hero_data in heroes:
            # Check if hero already exists
            if not Hero.objects.filter(name=hero_data['name']).exists():
                # Parse the date
                date_str = hero_data['released_date']
                released_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
                
                # Create the hero
                Hero.objects.create(
                    name=hero_data['name'],
                    role=hero_data['role'],
                    released_date=released_date
                )
                created_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully imported {created_count} heroes!')
        ) 