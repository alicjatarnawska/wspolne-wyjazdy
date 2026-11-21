# Przypadki testowe - etap 3

Opis tego, co testujemy i jakiego wyniku sie spodziewamy.
Po przetestowaniu wpisuje wynik: OK albo BLAD (+ krotki opis bledu).
Numeracja jest kontynuacja pliku przypadki-testowe-etap-2.md (TC-14 - TC-36).


## Opis wyjazdu - walidacja i bezpieczenstwo (WF-03)

Limit opisu: maksymalnie 1000 znakow (do ustalenia, zobacz uwagi).
Data testow: -

### TC-37 Opis ze skryptem nie jest wykonywany
- Warunki: uzytkownik jest zalogowany
- Kroki: tworzy wyjazd z opisem <script>alert('test')</script>
- Oczekiwany wynik: wyjazd sie tworzy, a opis jest zapisany jako zwykly tekst albo odrzucony (kod 400)
- Wynik: -

### TC-38 Skrypt w opisie wyswietla sie jako tekst
- Warunki: istnieje wyjazd z TC-37
- Kroki: uczestnik otwiera szczegoly wyjazdu w przegladarce
- Oczekiwany wynik: na ekranie widac napis <script>..., nie pojawia sie okienko alert
- Wynik: -

### TC-39 Opis o dlugosci dokladnie 1000 znakow
- Warunki: uzytkownik jest zalogowany
- Kroki: tworzy wyjazd z opisem dlugosci 1000 znakow
- Oczekiwany wynik: wyjazd sie tworzy (kod 201)
- Wynik: -

### TC-40 Za dlugi opis
- Warunki: uzytkownik jest zalogowany
- Kroki: tworzy wyjazd z opisem dlugosci 1001 znakow
- Oczekiwany wynik: wyjazd sie nie tworzy, komunikat o zbyt dlugim opisie (kod 400)
- Wynik: -

### TC-41 Opis nie jest tekstem
- Warunki: uzytkownik jest zalogowany
- Kroki: wysyla do API opis jako liczbe (description: 123)
- Oczekiwany wynik: wyjazd sie nie tworzy, komunikat o bledzie (kod 400)
- Wynik: -


## Szczegoly wyjazdu (WF-05)

Data testow: -

### TC-42 Uczestnik widzi szczegoly wyjazdu
- Warunki: Ola utworzyla wyjazd
- Kroki: Ola otwiera szczegoly wyjazdu
- Oczekiwany wynik: dane wyjazdu i rola Oli ORGANIZER (kod 200)
- Wynik: -

### TC-43 Osoba spoza wyjazdu nie widzi szczegolow
- Warunki: Ola utworzyla wyjazd, Kasia nie jest uczestnikiem
- Kroki: Kasia otwiera adres wyjazdu Oli
- Oczekiwany wynik: brak dostepu (kod 403) - sprawdza tez TC-12 z etapu 1
- Wynik: -

### TC-44 Wyjazd nie istnieje
- Warunki: uzytkownik jest zalogowany
- Kroki: otwiera wyjazd o numerze, ktorego nie ma (np. 999999)
- Oczekiwany wynik: komunikat ze nie znaleziono wyjazdu (kod 404)
- Wynik: -

### TC-45 Nieprawidlowy numer wyjazdu
- Warunki: uzytkownik jest zalogowany
- Kroki: otwiera adres /api/trips/abc
- Oczekiwany wynik: komunikat o nieprawidlowym identyfikatorze (kod 400)
- Wynik: -


## Lista uczestnikow (WF-04, WF-05)

Data testow: -

### TC-46 Lista uczestnikow z nickami
- Warunki: Ola utworzyla wyjazd i zaprosila Kasie
- Kroki: Ola otwiera liste uczestnikow
- Oczekiwany wynik: na liscie sa Ola i Kasia z nickami i rolami, organizator na poczatku (kod 200) - sprawdza tez TC-25 z etapu 2
- Wynik: -

### TC-47 Osoba spoza wyjazdu nie widzi listy uczestnikow
- Warunki: Alicja nie jest uczestnikiem wyjazdu Oli
- Kroki: Alicja otwiera liste uczestnikow wyjazdu Oli
- Oczekiwany wynik: brak dostepu (kod 403)
- Wynik: -


## Zmiana roli uczestnika

Data testow: -

### TC-48 Organizator nadaje role organizatora
- Warunki: Ola jest organizatorem, Kasia jest uczestnikiem
- Kroki: Ola zmienia role Kasi na ORGANIZER
- Oczekiwany wynik: Kasia ma role ORGANIZER (kod 200)
- Wynik: -

### TC-49 Uczestnik nie moze zmieniac rol
- Warunki: Kasia jest uczestnikiem wyjazdu Oli
- Kroki: Kasia probuje zmienic swoja role na ORGANIZER
- Oczekiwany wynik: rola sie nie zmienia, brak uprawnien (kod 403)
- Wynik: -

### TC-50 Jedyny organizator nie moze oddac roli
- Warunki: Ola jest jedynym organizatorem
- Kroki: Ola zmienia swoja role na PARTICIPANT
- Oczekiwany wynik: rola sie nie zmienia, komunikat ze wyjazd musi miec organizatora (kod 409)
- Wynik: -

### TC-51 Organizator oddaje role, gdy jest drugi organizator
- Warunki: Ola i Kasia sa organizatorkami (po TC-48)
- Kroki: Ola zmienia swoja role na PARTICIPANT
- Oczekiwany wynik: Ola ma role PARTICIPANT (kod 200)
- Wynik: -

### TC-52 Nieprawidlowa rola
- Warunki: Ola jest organizatorem, Kasia jest uczestnikiem
- Kroki: Ola zmienia role Kasi na ADMIN
- Oczekiwany wynik: rola sie nie zmienia, komunikat o nieprawidlowej roli (kod 400)
- Wynik: -

### TC-53 Zmiana roli osoby spoza wyjazdu
- Warunki: Ola jest organizatorem, Alicja nie jest uczestnikiem
- Kroki: Ola zmienia role Alicji na ORGANIZER
- Oczekiwany wynik: komunikat ze osoba nie jest uczestnikiem (kod 404)
- Wynik: -


## Profil uzytkownika

Data testow: -

### TC-54 Podglad profilu
- Warunki: uzytkownik jest zalogowany
- Kroki: otwiera swoj profil
- Oczekiwany wynik: widzi swoj e-mail i nick (kod 200)
- Wynik: -

### TC-55 Zmiana nicku
- Warunki: uzytkownik jest zalogowany
- Kroki: zmienia nick na "Nowy nick"
- Oczekiwany wynik: nick zostaje zmieniony (kod 200)
- Wynik: -

### TC-56 Nick taki sam jak obecny
- Warunki: uzytkownik ma nick "Zuza"
- Kroki: zmienia nick na "Zuza"
- Oczekiwany wynik: komunikat ze nick sie nie rozni (kod 400)
- Wynik: -

### TC-57 Nieprawidlowy nick przy zmianie
- Warunki: uzytkownik jest zalogowany
- Kroki: zmienia nick na same spacje, a potem na 51 znakow
- Oczekiwany wynik: nick sie nie zmienia, komunikat o bledzie (kod 400)
- Wynik: -

### TC-58 Zmiana e-maila
- Warunki: uzytkownik jest zalogowany
- Kroki: zmienia e-mail na nowy, wolny adres
- Oczekiwany wynik: e-mail zostaje zmieniony, mozna sie nim zalogowac (kod 200)
- Wynik: -

### TC-59 E-mail zajety
- Warunki: istnieje konto kasia@example.com
- Kroki: inny uzytkownik zmienia e-mail na kasia@example.com
- Oczekiwany wynik: e-mail sie nie zmienia, komunikat ze adres jest zajety (kod 409)
- Wynik: -

### TC-60 Nieprawidlowy format e-maila
- Warunki: uzytkownik jest zalogowany
- Kroki: zmienia e-mail na "abc"
- Oczekiwany wynik: e-mail sie nie zmienia, komunikat o blednym adresie (kod 400)
- Wynik: -

### TC-61 Zmiana hasla
- Warunki: uzytkownik jest zalogowany
- Kroki: podaje obecne haslo i nowe haslo, potem loguje sie nowym haslem
- Oczekiwany wynik: haslo zostaje zmienione (kod 200), logowanie nowym haslem dziala
- Wynik: -

### TC-62 Bledne obecne haslo
- Warunki: uzytkownik jest zalogowany
- Kroki: podaje nieprawidlowe obecne haslo i nowe haslo
- Oczekiwany wynik: haslo sie nie zmienia, komunikat o blednym hasle (kod 401)
- Wynik: -

### TC-63 Za krotkie nowe haslo
- Warunki: uzytkownik jest zalogowany
- Kroki: podaje nowe haslo krotsze niz 6 znakow
- Oczekiwany wynik: haslo sie nie zmienia, komunikat o zbyt krotkim hasle (kod 400)
- Wynik: -

### TC-64 Nowe haslo takie samo jak obecne
- Warunki: uzytkownik jest zalogowany
- Kroki: podaje jako nowe haslo to samo co obecne
- Oczekiwany wynik: komunikat ze nowe haslo musi sie roznic (kod 400)
- Wynik: -


## Usuwanie konta

Data testow: -

### TC-65 Usuniecie konta bez hasla
- Warunki: uzytkownik jest zalogowany
- Kroki: usuwa konto bez podania hasla
- Oczekiwany wynik: konto nie zostaje usuniete, komunikat o wymaganym hasle (kod 400)
- Wynik: -

### TC-66 Usuniecie konta z blednym haslem
- Warunki: uzytkownik jest zalogowany
- Kroki: usuwa konto, podajac nieprawidlowe haslo
- Oczekiwany wynik: konto nie zostaje usuniete, komunikat o blednym hasle (kod 401)
- Wynik: -

### TC-67 Jedyny organizator nie moze usunac konta
- Warunki: uzytkownik jest jedynym organizatorem wyjazdu, w ktorym sa inni uczestnicy
- Kroki: usuwa konto, podajac poprawne haslo
- Oczekiwany wynik: konto nie zostaje usuniete, komunikat z nazwa wyjazdu (kod 409)
- Wynik: -

### TC-68 Poprawne usuniecie konta
- Warunki: uzytkownik nie jest jedynym organizatorem zadnego wyjazdu z innymi uczestnikami
- Kroki: usuwa konto, podajac poprawne haslo, potem probuje sie zalogowac
- Oczekiwany wynik: konto zostaje usuniete (kod 200), logowanie nie dziala (kod 401)
- Wynik: -

### TC-69 Wyjazd bez innych uczestnikow usuwa sie razem z kontem
- Warunki: uzytkownik ma wyjazd, w ktorym jest jedyna osoba
- Kroki: usuwa konto
- Oczekiwany wynik: wyjazd znika z bazy razem z kontem
- Wynik: -

### TC-70 Mozna usunac konto po przekazaniu roli organizatora
- Warunki: jak w TC-67, organizator nadaje role ORGANIZER innemu uczestnikowi
- Kroki: usuwa konto, podajac poprawne haslo
- Oczekiwany wynik: konto zostaje usuniete (kod 200), wyjazd zostaje z nowym organizatorem
- Wynik: -

### TC-71 Zadania usunietego uzytkownika zostaja bez przypisania
- Warunki: uruchomiona migracja 003, uzytkownik ma przypisane zadanie w wyjezdzie
- Kroki: usuwa konto, potem w pgAdmin: SELECT name, assigned_user_id FROM tasks;
- Oczekiwany wynik: zadanie nadal istnieje, assigned_user_id jest pusty (NULL)
- Wynik: -


## Znalezione bledy

Brak.


## Uwagi dla backendu

- Opis wyjazdu nie jest teraz walidowany w createTrip (TC-37 - TC-41):
  - do ustalenia limit dlugosci (propozycja: 1000 znakow),
  - sprawdzanie, czy opis jest tekstem,
  - frontend nie moze wyswietlac opisu przez v-html (ochrona przed XSS).
- Usuwanie konta nie sprawdza dlugow - do dodania, gdy beda wydatki
  (dlug w obie strony: uzytkownik jest komus winny albo ktos jest winny jemu).
- TC-43 i TC-46 sprawdzaja tez TC-12 (etap 1) i TC-25 (etap 2), ktore wczesniej nie mogly byc przetestowane.
- Adresy:
  - GET /api/trips/:tripId - szczegoly wyjazdu
  - GET /api/trips/:tripId/members - lista uczestnikow
  - PATCH /api/trips/:tripId/members/:userId - zmiana roli, dane: { "role": "..." }
  - GET /api/users/profile, PATCH /api/users/profile/display-name, /email, /password
  - DELETE /api/users/profile - usuniecie konta, dane: { "password": "..." }
- Kody odpowiedzi:
  - 200 - pobrano / zmieniono / usunieto
  - 201 - wyjazd utworzony
  - 400 - bledne dane (TC-40, TC-41, TC-45, TC-52, TC-56, TC-57, TC-60, TC-63 - TC-65)
  - 401 - bledne haslo (TC-62, TC-66), logowanie po usunieciu konta (TC-68)
  - 403 - brak uprawnien (TC-43, TC-47, TC-49)
  - 404 - nie znaleziono (TC-44, TC-53)
  - 409 - konflikt (TC-50, TC-59, TC-67)