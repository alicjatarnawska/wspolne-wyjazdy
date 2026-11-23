# Przypadki testowe - etap 2

Opis tego, co testujemy i jakiego wyniku sie spodziewamy.
Po przetestowaniu wpisuje wynik: OK albo BLAD (+ krotki opis bledu).
Numeracja jest kontynuacja pliku przypadki-testowe-etap-1.md (TC-01 - TC-13).
Testy automatyczne API: tests/members.test.js i tests/auth.test.js (uruchomienie: npm test w folderze tests).


## Zapraszanie uczestnika do wyjazdu (WF-04)

Scenariusz z dokumentacji: punkt 4.4 "Zaproszenie uczestnika do wyjazdu".
Data testow: 17.11.2026

### TC-14 Organizator zaprasza uczestnika
- Warunki: Ola jest organizatorem wyjazdu, Kasia ma konto i nie jest uczestnikiem
- Kroki: Ola podaje e-mail kasia@example.com i zatwierdza
- Oczekiwany wynik: Kasia zostaje dodana z rola PARTICIPANT (kod 201)
- Wynik: OK

### TC-15 Zaproszona osoba widzi wyjazd
- Warunki: jak po TC-14
- Kroki: Kasia otwiera liste "Moje wyjazdy"
- Oczekiwany wynik: wyjazd Oli jest na liscie Kasi, z rola PARTICIPANT
- Wynik: OK

### TC-16 Wielkosc liter w e-mailu nie ma znaczenia
- Warunki: Ola jest organizatorem, Alicja nie jest uczestnikiem
- Kroki: Ola podaje e-mail ALICJA@Example.com
- Oczekiwany wynik: Alicja zostaje dodana (kod 201)
- Wynik: OK

### TC-25 Organizator widzi liste uczestnikow z nickami
- Warunki: Kasia zostala dodana (po TC-14)
- Kroki: Ola otwiera liste uczestnikow wyjazdu
- Oczekiwany wynik: na liscie sa Ola (organizator) i Kasia (uczestnik), wyswietlone nickami
- Wynik: - OK (sprawdzone w TC-46, etap 3, 23.11.2026)


## Zapraszanie - bledne dane

### TC-17 Brak konta o podanym e-mailu
- Warunki: Ola jest organizatorem
- Kroki: Ola podaje e-mail nieistnieje@example.com
- Oczekiwany wynik: nikt nie zostaje dodany, komunikat ze nie znaleziono konta (kod 404)
- Wynik: OK

### TC-18 Osoba jest juz uczestnikiem
- Warunki: Kasia jest juz uczestnikiem wyjazdu (po TC-14)
- Kroki: Ola ponownie zaprasza kasia@example.com
- Oczekiwany wynik: Kasia nie zostaje dodana drugi raz, komunikat ze jest juz uczestnikiem (kod 409)
- Wynik: OK

### TC-19 Organizator zaprasza samego siebie
- Warunki: Ola jest organizatorem
- Kroki: Ola podaje swoj e-mail ola@example.com
- Oczekiwany wynik: nic sie nie zmienia, komunikat ze jest juz uczestnikiem (kod 409)
- Wynik: OK

### TC-20 Brak e-maila
- Warunki: Ola jest organizatorem
- Kroki: Ola zatwierdza zaproszenie z pustym polem e-mail
- Oczekiwany wynik: nikt nie zostaje dodany, komunikat o bledzie (kod 400)
- Wynik: OK


## Zapraszanie - uprawnienia (WF-05)

### TC-21 Uczestnik nie moze zapraszac
- Warunki: Kasia jest uczestnikiem (nie organizatorem) wyjazdu Oli
- Kroki: Kasia probuje zaprosic alicja@example.com
- Oczekiwany wynik: Alicja nie zostaje dodana, komunikat ze tylko organizator moze zapraszac (kod 403)
- Wynik: OK

### TC-22 Osoba spoza wyjazdu nie moze zapraszac
- Warunki: Alicja nie jest uczestnikiem wyjazdu Oli
- Kroki: Alicja probuje zaprosic kogos do wyjazdu Oli
- Oczekiwany wynik: nikt nie zostaje dodany, brak dostepu (kod 403)
- Wynik: OK

### TC-23 Uzytkownik niezalogowany
- Warunki: uzytkownik nie jest zalogowany
- Kroki: wysyla zaproszenie bezposrednio do API
- Oczekiwany wynik: nikt nie zostaje dodany, brak dostepu (kod 401)
- Wynik: OK

### TC-24 Wyjazd nie istnieje
- Warunki: Ola jest zalogowana
- Kroki: Ola zaprasza kogos do wyjazdu o numerze, ktorego nie ma (np. 999999)
- Oczekiwany wynik: nikt nie zostaje dodany, komunikat o bledzie (kod do ustalenia, zobacz uwagi)
- Wynik: OK (backend zwraca 403)


## Nick uzytkownika (rejestracja)

Nick: wymagany, maksymalnie 50 znakow, bez samych spacji, nie musi byc unikalny.
Data testow: 17.11.2026

### TC-26 Rejestracja z nickiem
- Warunki: brak konta o podanym e-mailu
- Kroki: podaje e-mail, haslo i nick "Zuza" i zatwierdza
- Oczekiwany wynik: konto sie tworzy, nick zapisany w bazie (kod 201)
- Wynik: OK

### TC-27 Nick zwracany po zalogowaniu
- Warunki: konto z TC-26 istnieje
- Kroki: loguje sie tym kontem
- Oczekiwany wynik: w danych uzytkownika jest nick "Zuza" (kod 200)
- Wynik: OK

### TC-28 Nick z polskimi znakami
- Warunki: brak konta o podanym e-mailu
- Kroki: rejestruje sie z nickiem "Łucja Żak"
- Oczekiwany wynik: konto sie tworzy, nick zapisany bez zmian
- Wynik: OK

### TC-29 Spacje na poczatku i koncu nicku
- Warunki: brak konta o podanym e-mailu
- Kroki: rejestruje sie z nickiem " Zuza "
- Oczekiwany wynik: konto sie tworzy, w bazie zapisany nick "Zuza"
- Wynik: OK

### TC-30 Nick o dlugosci dokladnie 50 znakow
- Warunki: brak konta o podanym e-mailu
- Kroki: rejestruje sie z nickiem dlugosci 50 znakow
- Oczekiwany wynik: konto sie tworzy
- Wynik: OK


## Nick - bledne dane

### TC-31 Brak nicku
- Warunki: brak konta o podanym e-mailu
- Kroki: rejestruje sie bez nicku
- Oczekiwany wynik: konto sie nie tworzy, komunikat ze nick jest wymagany (kod 400)
- Wynik: OK

### TC-32 Nick z samych spacji
- Warunki: brak konta o podanym e-mailu
- Kroki: rejestruje sie z nickiem "   "
- Oczekiwany wynik: konto sie nie tworzy, komunikat ze nick jest wymagany (kod 400)
- Wynik: OK

### TC-33 Za dlugi nick
- Warunki: brak konta o podanym e-mailu
- Kroki: rejestruje sie z nickiem dlugosci 51 znakow
- Oczekiwany wynik: konto sie nie tworzy, komunikat o zbyt dlugim nicku (kod 400)
- Wynik: OK

### TC-34 Nick zajety przez inna osobe
- Warunki: istnieje konto z nickiem "Kasia"
- Kroki: nowa osoba rejestruje sie z nickiem "Kasia"
- Oczekiwany wynik: konto sie tworzy (kod 201) - nick nie musi byc unikalny
- Wynik: OK


## Nick - baza danych

### TC-35 Istniejace konta maja nick po migracji
- Warunki: baza z kontami sprzed dodania nicku, uruchomiona migracja 002
- Kroki: w pgAdmin: SELECT email, display_name FROM users;
- Oczekiwany wynik: kazde konto ma nick (np. ola@example.com -> Ola)
- Wynik: OK

### TC-36 Baza nie przyjmuje konta bez nicku
- Warunki: uruchomiona migracja 002
- Kroki: w pgAdmin: INSERT INTO users (email, password_hash) VALUES ('test@x.pl', 'x');
- Oczekiwany wynik: baza odrzuca zapis (blad NOT NULL)
- Wynik: OK


## Znalezione bledy

Brak.


## Uwagi dla backendu

- Zapraszanie: POST /api/trips/:tripId/members, dane: { "email": "..." }.
- Do listy uczestnikow (TC-25) potrzebny jest nowy endpoint, np. GET /api/trips/:tripId/members,
  zwracajacy nick i role kazdego uczestnika.
- Ustalone:
  - pole nicku w rejestracji: display_name
  - nick nie jest unikalny (TC-34)
- Do ustalenia:
  - TC-24: wyjazd nie istnieje - backend zwraca 403, moze lepiej 404 "Wyjazd nie istnieje"
- Kody odpowiedzi:
  - 200 - zalogowano (TC-27)
  - 201 - uczestnik dodany / konto utworzone
  - 400 - bledne dane (TC-20, TC-31 do TC-33)
  - 401 - niezalogowany (TC-23)
  - 403 - brak uprawnien (TC-21, TC-22, TC-24)
  - 404 - nie znaleziono konta (TC-17)
  - 409 - osoba juz jest uczestnikiem (TC-18, TC-19)