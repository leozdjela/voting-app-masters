# Voting App Masters

Ovaj repozitorij sadrži prototip decentralizirane aplikacije za digitalno glasanje razvijene u sklopu diplomskog rada.

Sustav demonstrira primjenu blockchain tehnologije i pametnih ugovora za sigurno, transparentno i provjerljivo glasanje.

---

## Opis projekta

Aplikacija omogućuje korisnicima sudjelovanje u procesu glasanja uz sljedeće karakteristike:

- sprječavanje višestrukog glasanja
- transparentan prikaz rezultata
- nepromjenjiv zapis glasova na blockchainu
- odvajanje identiteta korisnika od samog glasa

---

## Arhitektura sustava

Sustav je implementiran kao višeslojna web aplikacija:

- **Frontend (React)**  
  korisničko sučelje za prijavu, glasanje i prikaz rezultata

- **Backend (Node.js / Express)**  
  autentifikacija korisnika i komunikacija s blockchainom

- **Smart contract (Solidity)**  
  logika glasanja i pohrana rezultata na Ethereum mreži

---

## Tehnologije

- Node.js
- Express.js
- React
- Solidity
- Hardhat
- ethers.js
- dotenv

---

## Struktura repozitorija

```text
backend/              aplikacijski poslužitelj
contracts/            pametni ugovori (Solidity)
frontend/             korisničko sučelje
ignition/modules/     skripte za deploy ugovora
scripts/              pomoćne skripte
test/                 testovi
