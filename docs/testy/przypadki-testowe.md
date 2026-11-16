# Przypadki testowe

Opis tego, co testujemy i jakiego wyniku sie spodziewamy.
Po przetestowaniu wpisuje wynik: OK albo BLAD (+ krotki opis bledu).
Testy automatyczne API: tests/trips.test.js (uruchomienie: npm test w folderze tests).


## Tworzenie wyjazdu (WF-03)

Data testow: 16.11.2026

### TC-01 Utworzenie wyjazdu
- Warunki: uzytkownik jest zalogowany
- Kroki: wpisuje nazwe "Mazury", miejsce "Gizycko", daty 14.05.2027 - 16.05.2027, opis i zatwierdza
- Oczekiwany wynik: wyjazd sie tworzy (kod 201)
- Wynik: OK

### TC-02 Tworca zostaje organizatorem
- Warunki: jak w TC-01
- Kroki: tworzy wyjazd jak w TC-01
- Oczekiwany wynik: w tabeli trip_members jest wiersz z tym uzytkownikiem i rola ORGANIZER
- Wynik: OK czesciowo - sprawdzone tylko w odpowiedzi API, gdzie rola jest wpisana na sztywno;
  nie sprawdzono zapisu w tabeli trip_members

### TC-03 Wyjazd bez opisu
- Warunki: uzytkownik jest zalogowany
- Kroki: tworzy wyjazd, zostawia puste pole opisu
- Oczekiwany wynik: wyjazd sie tworzy (opis nie jest wymagany)
- Wynik: OK

### TC-04 Wyjazd jednodniowy
- Warunki: uzytkownik jest zalogowany
- Kroki: wpisuje te sama date poczatkowa i koncowa
- Oczekiwany wynik: wyjazd sie tworzy
- Wynik: OK

### TC-05 Wyjazd widoczny na liscie
- Warunki: uzytkownik utworzyl wyjazd
- Kroki: otwiera liste "Moje wyjazdy"
- Oczekiwany wynik: nowy wyjazd jest na liscie
- Wynik: OK


## Bledne dane

Limit dlugosci: nazwa i miejsce docelowe maksymalnie 100 znakow.

### TC-06 Brak nazwy
- Warunki: uzytkownik jest zalogowany
- Kroki: zatwierdza formularz bez nazwy
- Oczekiwany wynik: wyjazd sie nie tworzy, komunikat o bledzie (kod 400)
- Wynik: OK

### TC-07 Brak miejsca docelowego
- Warunki: uzytkownik jest zalogowany
- Kroki: zatwierdza formularz bez miejsca
- Oczekiwany wynik: wyjazd sie nie tworzy, komunikat o bledzie (kod 400)
- Wynik: OK

### TC-08 Data koncowa przed poczatkowa
- Warunki: uzytkownik jest zalogowany
- Kroki: wpisuje daty 14.05.2027 - 13.05.2027
- Oczekiwany wynik: wyjazd sie nie tworzy, komunikat ze data koncowa nie moze byc wczesniejsza (kod 400)
- Wynik: OK

### TC-09 Za dluga nazwa
- Warunki: uzytkownik jest zalogowany
- Kroki: wpisuje nazwe dluzsza niz 100 znakow
- Oczekiwany wynik: wyjazd sie nie tworzy, komunikat o zbyt dlugiej nazwie (kod 400)
- Wynik: OK (po poprawce B-01, test ponowny 16.11.2026)

### TC-10 Uzytkownik niezalogowany
- Warunki: uzytkownik nie jest zalogowany
- Kroki: wysyla zapytanie o utworzenie wyjazdu bezposrednio do API
- Oczekiwany wynik: wyjazd sie nie tworzy, brak dostepu (kod 401)
- Wynik: OK

### TC-13 Nazwa z samych spacji
- Warunki: uzytkownik jest zalogowany
- Kroki: wpisuje jako nazwe same spacje
- Oczekiwany wynik: wyjazd sie nie tworzy, komunikat ze nazwa jest wymagana (kod 400)
- Wynik: OK (po poprawce B-02, test ponowny 16.11.2026)


## Uprawnienia (WF-05)

### TC-11 Cudzy wyjazd nie jest widoczny na liscie
- Warunki: Ola utworzyla wyjazd, Kasia nie jest jego uczestnikiem
- Kroki: Kasia otwiera liste "Moje wyjazdy"
- Oczekiwany wynik: wyjazdu Oli nie ma na liscie Kasi
- Wynik: OK

### TC-12 Brak dostepu do cudzego wyjazdu
- Warunki: jak w TC-11
- Kroki: Kasia wchodzi na adres wyjazdu Oli
- Oczekiwany wynik: brak dostepu (kod 403)
- Wynik: - (nie do przetestowania: backend nie ma jeszcze adresu do otwierania pojedynczego wyjazdu)


## Znalezione bledy

### B-01 Brak walidacji dlugosci nazwy wyjazdu
- Wykryty przez: TC-09
- Opis: przy nazwie dluzszej niz 100 znakow backend zwraca 500 ("Nie udalo sie utworzyc wyjazdu")
  zamiast 400. Baza odrzuca zapis (VARCHAR(100)), a createTrip nie obsluguje tego bledu.
- Propozycja: sprawdzac dlugosc nazwy i miejsca (max 100 znakow) w walidacji na poczatku createTrip.
- Status: poprawiony - potwierdzony testem ponownym 16.11.2026

### B-02 Mozna utworzyc wyjazd z nazwa z samych spacji
- Wykryty przez: TC-13
- Opis: backend sprawdza, czy nazwa nie jest pusta, przed trim(), wiec '   ' przechodzi walidacje
  i zapisuje sie jako pusty napis. Kod 201 zamiast 400. Dotyczy tez destination.
- Propozycja: najpierw trim(), potem sprawdzenie; dodatkowo CHECK w bazie.
- Status: poprawiony - potwierdzony testem ponownym 16.11.2026


## Uwagi dla backendu

- Zapis do trips i trip_members odbywa sie w jednej transakcji - zrobione.
- Walidacja musi byc tez w backendzie, nie tylko w formularzu - do API mozna wyslac
  zapytanie z pominieciem frontendu (TC-10).
- Kody odpowiedzi:
  - 201 - wyjazd utworzony
  - 400 - bledne dane (TC-06 do TC-09, TC-13)
  - 401 - niezalogowany (TC-10)
  - 403 - brak dostepu do cudzego wyjazdu (TC-12)