# program formatori · festivalul ideo ideis #21

Vederile pe echipe ale programului intern, pentru oamenii din afara echipei
de organizare:

- **/** — program formatori (traineri teatru tânăr & arte alăturate, mentori,
  trupe; cu selectorul „urmărește o trupă” și linkuri directe `?t=leira` etc.)
- **/artplay/** — program formatori Art&Play (atelierele de comunitate +
  evenimentele mari; fără repetiții, tehnic, organizare sau transporturi)

## De unde vin datele (important)

**Acest repo NU are propriul program.** Ambele pagini încarcă `program.js`
direct de pe site-ul master:

    https://ideoideis.github.io/program-intern-21/program.js

Deci: **orice schimbare de program se face O SINGURĂ DATĂ**, în repo-ul
[program-intern-21](https://github.com/ideoideis/program-intern-21), și apare
automat și aici (și pe orice altă vedere viitoare), la următoarea deschidere a
paginii. Aici nu se editează decât CE se vede (configurarea `window.AUD` din
fiecare `index.html`) și motorul comun (`shared/schedule.js`).

Ce vede fiecare public se controlează din obiectul `AUD` din pagina lui:
categorii (`cats`), zile ascunse (`skipDays`), repetiții (`compact`),
transporturi (`transport`), necesar (`showNeeds`), blocurile din +info etc.

## Publicare

Push pe `main` → GitHub Actions publică automat pe GitHub Pages:
https://ideoideis.github.io/program-intern-formatori/

## Linkuri per trupă

Nu e nevoie de câte un repo/pagină per trupă — fiecare trupă primește linkul ei:

    https://ideoideis.github.io/program-intern-formatori/?t=leira
    ?t=atelierul · ?t=artwork · ?t=amprente · ?t=brainstorming
    ?t=alexandria · ?t=act · ?t=protha

Linkul deschide pagina direct pe ziua spectacolului trupei, cu drumul ei
evidențiat și celelalte trupe ascunse.

## Test în afara festivalului

Adaugă `?test=v31-19:32` (zi-oră) la URL ca să simulezi marcajul „acum”.
