# Przypadki testowe - etap 4

Opis tego, co testujemy i jakiego wyniku sie spodziewamy.
Po przetestowaniu wpisuje wynik: OK albo BLAD (+ krotki opis bledu).
Numeracja jest kontynuacja pliku przypadki-testowe-etap-3.md (TC-37 - TC-71).
Testy automatyczne API: tests/trips.test.js, tests/members.test.js, tests/plan.test.js, tests/tasks.test.js.


## Edycja wyjazdu

Data testow: 23.11.2026

### TC-72 Organizator edytuje wyjazd
- Warunki: Ola jest organizatorem wyjazdu
- Kroki: Ola zmienia nazwe wyjazdu na "Mazury 2027"
- Oczekiwany wynik: nazwa zostaje zmieniona (kod 200)
- Wynik: OK

### TC-73 Uczestnik nie moze edytowac wyjazdu
- Warunki: Kasia jest uczestnikiem wyjazdu Oli
- Kroki: Kasia probuje zmienic nazwe wyjazdu
- Oczekiwany wynik: dane sie nie zmieniaja, brak uprawnien (kod 403)
- Wynik: OK

### TC-74 Edycja z data koncowa przed poczatkowa
- Warunki: Ola jest organizatorem wyjazdu
- Kroki: Ola ustawia date koncowa wczesniejsza niz poczatkowa
- Oczekiwany wynik: dane sie nie zmieniaja, komunikat o blednych datach (kod 400)
- Wynik: OK

### TC-75 Skrocenie terminu, gdy w harmonogramie sa aktywnosci poza nowymi datami
- Warunki: wyjazd 14.05 - 16.05, w harmonogramie jest aktywnosc 16.05
- Kroki: Ola zmienia date koncowa na 15.05
- Oczekiwany wynik: termin sie nie zmienia, komunikat o aktywnosciach poza zakresem (kod 409)
- Wynik: OK

### TC-76 Edycja opisu z niebezpiecznym kodem HTML
- Warunki: Ola jest organizatorem wyjazdu
- Kroki: Ola zmienia opis na <img src=x onerror="alert(1)">
- Oczekiwany wynik: opis sie nie zmienia, komunikat ze opis nie moze zawierac niebezpiecznego kodu (kod 400)
- Wynik: OK


## Usuwanie wyjazdu

Data testow: 23.11.2026

### TC-77 Organizator usuwa wyjazd
- Warunki: Ola jest organizatorem wyjazdu
- Kroki: Ola usuwa wyjazd, potem probuje otworzyc jego szczegoly
- Oczekiwany wynik: wyjazd zostaje usuniety (kod 200), szczegoly zwracaja 404
- Wynik: OK

### TC-78 Uczestnik nie moze usunac wyjazdu
- Warunki: Kasia jest uczestnikiem wyjazdu Oli
- Kroki: Kasia probuje usunac wyjazd
- Oczekiwany wynik: wyjazd nie zostaje usuniety, brak uprawnien (kod 403)
- Wynik: OK

### TC-79 Usuniecie wyjazdu usuwa jego harmonogram i zadania
- Warunki: wyjazd ma aktywnosci w harmonogramie i zadania
- Kroki: Ola usuwa wyjazd, potem w pgAdmin sprawdza plan_items i tasks dla tego trip_id
- Oczekiwany wynik: nie ma juz aktywnosci ani zadan tego wyjazdu
- Wynik: OK (harmonogram i zadania usuniete - sprawdzone w bazie)


## Wyrzucanie i opuszczanie wyjazdu

Data testow: 23.11.2026

### TC-80 Organizator wyrzuca uczestnika
- Warunki: Ola jest organizatorem, Kasia jest uczestnikiem
- Kroki: Ola usuwa Kasie z wyjazdu, potem Kasia otwiera liste "Moje wyjazdy"
- Oczekiwany wynik: Kasia zostaje usunieta (kod 200), wyjazdu nie ma na jej liscie
- Wynik: OK

### TC-81 Uczestnik nie moze wyrzucic innej osoby
- Warunki: Kasia i Alicja sa uczestniczkami wyjazdu Oli
- Kroki: Kasia probuje usunac Alicje z wyjazdu
- Oczekiwany wynik: Alicja zostaje w wyjezdzie, brak uprawnien (kod 403)
- Wynik: OK

### TC-82 Uczestnik opuszcza wyjazd
- Warunki: Kasia jest uczestnikiem wyjazdu Oli
- Kroki: Kasia opuszcza wyjazd
- Oczekiwany wynik: Kasia nie jest juz uczestnikiem (kod 200)
- Wynik: OK

### TC-83 Jedyny organizator nie moze opuscic wyjazdu
- Warunki: Ola jest jedynym organizatorem, Kasia jest uczestnikiem
- Kroki: Ola opuszcza wyjazd
- Oczekiwany wynik: Ola zostaje w wyjezdzie, komunikat o przekazaniu roli (kod 409)
- Wynik: OK

### TC-84 Jedyny uczestnik nie moze opuscic wyjazdu
- Warunki: Ola jest jedyna osoba w wyjezdzie
- Kroki: Ola opuszcza wyjazd
- Oczekiwany wynik: Ola zostaje w wyjezdzie, komunikat zeby usunac caly wyjazd (kod 409)
- Wynik: OK

### TC-85 Zadania wyrzuconej osoby zostaja bez przypisania
- Warunki: Kasia ma przypisane zadanie w wyjezdzie Oli
- Kroki: Ola usuwa Kasie z wyjazdu, potem otwiera liste zadan
- Oczekiwany wynik: zadanie nadal istnieje, nie ma przypisanej osoby
- Wynik: OK

### TC-86 Wyrzucenie osoby spoza wyjazdu
- Warunki: Ola jest organizatorem, Alicja nie jest uczestnikiem
- Kroki: Ola probuje usunac Alicje z wyjazdu
- Oczekiwany wynik: komunikat ze osoba nie jest uczestnikiem (kod 404)
- Wynik: OK


## Harmonogram (WF-06)

Data testow: 23.11.2026

### TC-87 Dodanie aktywnosci
- Warunki: Kasia jest uczestnikiem wyjazdu 14.05 - 16.05
- Kroki: dodaje aktywnosc "Kajaki" 15.05 o 11:00
- Oczekiwany wynik: aktywnosc zostaje dodana (kod 201)
- Wynik: OK

### TC-88 Aktywnosc bez godziny
- Warunki: jak w TC-87
- Kroki: dodaje aktywnosc 15.05 bez godziny
- Oczekiwany wynik: aktywnosc zostaje dodana (kod 201) - godzina nie jest wymagana
- Wynik: OK

### TC-89 Data poza terminem wyjazdu
- Warunki: wyjazd 14.05 - 16.05
- Kroki: dodaje aktywnosc 17.05
- Oczekiwany wynik: aktywnosc nie zostaje dodana, komunikat o dacie poza terminem (kod 400)
- Wynik: OK

### TC-90 Nieistniejaca data
- Warunki: uczestnik wyjazdu
- Kroki: dodaje aktywnosc z data 2027-02-30
- Oczekiwany wynik: aktywnosc nie zostaje dodana, komunikat o blednej dacie (kod 400)
- Wynik: OK

### TC-91 Nieprawidlowa godzina
- Warunki: uczestnik wyjazdu
- Kroki: dodaje aktywnosc o godzinie 25:00
- Oczekiwany wynik: aktywnosc nie zostaje dodana, komunikat o blednej godzinie (kod 400)
- Wynik: OK

### TC-92 Brak tytulu
- Warunki: uczestnik wyjazdu
- Kroki: dodaje aktywnosc bez tytulu
- Oczekiwany wynik: aktywnosc nie zostaje dodana, komunikat o wymaganym tytule (kod 400)
- Wynik: OK

### TC-93 Za dlugi tytul
- Warunki: uczestnik wyjazdu
- Kroki: dodaje aktywnosc z tytulem dlugosci 151 znakow
- Oczekiwany wynik: aktywnosc nie zostaje dodana, komunikat o zbyt dlugim tytule (kod 400)
- Wynik: OK

### TC-94 Osoba spoza wyjazdu nie moze dodac aktywnosci
- Warunki: Alicja nie jest uczestnikiem wyjazdu Oli
- Kroki: Alicja probuje dodac aktywnosc
- Oczekiwany wynik: aktywnosc nie zostaje dodana, brak dostepu (kod 403)
- Wynik: OK

### TC-95 Edycja aktywnosci
- Warunki: w harmonogramie jest aktywnosc "Kajaki"
- Kroki: uczestnik zmienia jej godzine na 12:00
- Oczekiwany wynik: godzina zostaje zmieniona (kod 200)
- Wynik: OK

### TC-96 Usuniecie aktywnosci
- Warunki: w harmonogramie jest aktywnosc "Kajaki"
- Kroki: uczestnik usuwa aktywnosc
- Oczekiwany wynik: aktywnosc znika z harmonogramu (kod 200)
- Wynik: OK

### TC-97 Aktywnosc z innego wyjazdu
- Warunki: aktywnosc nalezy do wyjazdu A, uzytkownik jest w wyjezdzie A i B
- Kroki: edytuje te aktywnosc przez adres wyjazdu B
- Oczekiwany wynik: komunikat ze nie znaleziono aktywnosci w tym wyjezdzie (kod 404)
- Wynik: OK

### TC-98 Kod HTML w tytule lub opisie aktywnosci
- Warunki: uczestnik wyjazdu
- Kroki: dodaje aktywnosc z tytulem <img src=x onerror="alert(1)">
- Oczekiwany wynik: aktywnosc nie zostaje dodana (kod 400) - tak jak przy nazwie i opisie wyjazdu
- Wynik: BLAD - aktywnosc zostala dodana (kod 201), zobacz B-04

### TC-99 Bardzo dlugi opis aktywnosci
- Warunki: uczestnik wyjazdu
- Kroki: dodaje aktywnosc z opisem dlugosci 501 znakow
- Oczekiwany wynik: aktywnosc nie zostaje dodana (kod 400) - limit do ustalenia, zobacz uwagi
- Wynik: BLAD - aktywnosc zostala dodana (kod 201), zobacz B-05


## Zadania (WF-07)

Data testow: 23.11.2026

### TC-100 Zadanie bez przypisanej osoby
- Warunki: Kasia jest uczestnikiem wyjazdu
- Kroki: dodaje zadanie "Kupic bilety" bez przypisanej osoby
- Oczekiwany wynik: zadanie zostaje dodane bez osoby, status TODO (kod 201)
- Wynik: OK

### TC-101 Zadanie przypisane uczestnikowi
- Warunki: Kasia jest uczestnikiem wyjazdu Oli
- Kroki: Ola dodaje zadanie przypisane Kasi
- Oczekiwany wynik: zadanie zostaje dodane, widoczny nick osoby (kod 201)
- Wynik: OK

### TC-102 Przypisanie osoby spoza wyjazdu
- Warunki: Alicja nie jest uczestnikiem wyjazdu Oli
- Kroki: Ola dodaje zadanie przypisane Alicji
- Oczekiwany wynik: zadanie nie zostaje dodane, komunikat ze osoba nie jest uczestnikiem (kod 400)
- Wynik: OK

### TC-103 Oznaczenie zadania jako zrobione
- Warunki: istnieje zadanie ze statusem TODO
- Kroki: uczestnik zmienia status na DONE
- Oczekiwany wynik: status zostaje zmieniony (kod 200)
- Wynik: OK

### TC-104 Nieprawidlowy status
- Warunki: istnieje zadanie
- Kroki: uczestnik zmienia status na MAYBE
- Oczekiwany wynik: status sie nie zmienia, komunikat o blednym statusie (kod 400)
- Wynik: OK

### TC-105 Brak nazwy lub za dluga nazwa zadania
- Warunki: uczestnik wyjazdu
- Kroki: dodaje zadanie bez nazwy, potem z nazwa dlugosci 151 znakow
- Oczekiwany wynik: zadanie nie zostaje dodane, komunikat o bledzie (kod 400)
- Wynik: OK

### TC-106 Osoba spoza wyjazdu nie moze dodac zadania
- Warunki: Alicja nie jest uczestnikiem wyjazdu Oli
- Kroki: Alicja probuje dodac zadanie
- Oczekiwany wynik: zadanie nie zostaje dodane, brak dostepu (kod 403)
- Wynik: OK

### TC-107 Usuniecie zadania
- Warunki: istnieje zadanie
- Kroki: uczestnik usuwa zadanie
- Oczekiwany wynik: zadanie znika z listy (kod 200)
- Wynik: OK

### TC-108 Zadanie z innego wyjazdu
- Warunki: zadanie nalezy do wyjazdu A, uzytkownik jest w wyjezdzie A i B
- Kroki: edytuje to zadanie przez adres wyjazdu B
- Oczekiwany wynik: komunikat ze nie znaleziono zadania w tym wyjezdzie (kod 404)
- Wynik: OK

### TC-109 Nieprawidlowy termin zadania
- Warunki: uczestnik wyjazdu
- Kroki: dodaje zadanie z terminem "jutro"
- Oczekiwany wynik: zadanie nie zostaje dodane, komunikat o blednej dacie (kod 400)
- Wynik: OK

### TC-110 Kod HTML w nazwie zadania
- Warunki: uczestnik wyjazdu
- Kroki: dodaje zadanie z nazwa <script>alert(1)</script>
- Oczekiwany wynik: zadanie nie zostaje dodane (kod 400) - tak jak przy nazwie i opisie wyjazdu
- Wynik: BLAD - zadanie zostalo dodane (kod 201), zobacz B-04


## Znalezione bledy

### B-04 Brak ochrony przed kodem HTML w harmonogramie i zadaniach
- Wykryty przez: TC-98, TC-110
- Opis: tytul aktywnosci <img src=x onerror="alert(1)"> i nazwa zadania
  <script>alert(1)</script> sa zapisywane (kod 201). Przy wyjezdzie ten sam tekst daje 400.
- Propozycja: uzyc tej samej funkcji containsScriptOrHtml co w tripController
  dla tytulu i opisu aktywnosci oraz nazwy zadania.
- Status: zgloszony

### B-05 Brak limitu dlugosci opisu aktywnosci
- Wykryty przez: TC-99
- Opis: opis aktywnosci o dlugosci 501 znakow zostaje zapisany (kod 201).
- Propozycja: limit 500 znakow, tak jak opis wyjazdu.
- Status: zgloszony


## Uwagi dla backendu

- Harmonogram i zadania moze edytowac kazdy uczestnik, a wyjazd tylko organizator - zgodnie z rolami z dokumentacji.
- Adresy:
  - PATCH /api/trips/:tripId, DELETE /api/trips/:tripId - edycja i usuwanie wyjazdu
  - DELETE /api/trips/:tripId/members/:userId - wyrzucenie (me = opuszczenie wyjazdu)
  - GET, POST /api/trips/:tripId/plan, PATCH, DELETE /api/trips/:tripId/plan/:itemId
  - GET, POST /api/trips/:tripId/tasks, PATCH, DELETE /api/trips/:tripId/tasks/:taskId
- Kody odpowiedzi:
  - 200 - zmieniono / usunieto
  - 201 - dodano aktywnosc / zadanie
  - 400 - bledne dane (TC-74, TC-76, TC-89 - TC-93, TC-98, TC-99, TC-102, TC-104, TC-105, TC-109, TC-110)
  - 403 - brak uprawnien (TC-73, TC-78, TC-81, TC-94, TC-106)
  - 404 - nie znaleziono (TC-86, TC-97, TC-108)
  - 409 - konflikt (TC-75, TC-83, TC-84)