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


6.6. UPUTE ZA LOKALNO POKRETANJE PROJEKTA
Za ispravno funkcioniranje sustava preporučuje se sljedeći redoslijed:
1.	preuzimanje repozitorija 
2.	instalacija ovisnosti 
3.	konfiguracija .env datoteka 
4.	kompilacija pametnog ugovora 
5.	implementacija ugovora na Sepolia mrežu 
6.	upis adrese ugovora u frontend konfiguraciju 
7.	pokretanje backend poslužitelja 
8.	pokretanje frontend aplikacije

Za lokalno pokretanje razvijenog sustava potrebno je preuzeti izvorni kod iz Git repozitorija te konfigurirati razvojno okruženje. Sustav je implementiran kao višeslojna aplikacija koja se sastoji od korisničkog sučelja (frontend), aplikacijskog poslužitelja (backend) i pametnog ugovora na blockchain mreži.
	Za pokretanje projekta potrebno je imati instalirane sljedeće alate: 
•	Node.js i npm
•	Git
•	Kripto novčanik (npr. MetaMask)
•	Pristup Ethereum Sepolia testnoj mreži
Projekt koristi React u frontend dijelu, Node.js i Express u backend dijelu te Hardhat za razvoj i implementaciju pametnih ugovora. Projekt se preuzima iz Git repozitorija (https://github.com/leozdjela/voting-app-masters.git), nakon čega je potrebno instalirati ovisnosti u svim dijelovima sustava:

										git clone https://github.com/leozdjela/voting-app-masters.git
										cd voting-app-masters
										
										npm install
										cd backend
										npm install
										cd ../frontend
										npm install
										cd ..

Instalacija ovisnosti predstavlja prvi korak u pokretanju sustava, nakon čega slijedi konfiguracija varijabli okruženja, implementacija pametnog ugovora i pokretanje same aplikacije. 
6.6.1. Konfiguracija varijabli okruženja
Radi sigurnosti, osjetljivi podaci nisu uključeni u repozitorij, već se definiraju putem .env datoteka koje su isključene iz verzioniranja. U projektu su dostupne env_primjeri datoteke koje služe kao predložak. Korisnik treba na temelju tih predložaka izraditi vlastite .env datoteke te u njih unijeti odgovarajuće vrijednosti konfiguracijskih varijabli. Osjetljivi podaci, poput privatnih ključeva i tajnih vrijednosti poslužitelja, moraju se definirati lokalno i ne smiju se dijeliti. S druge strane, određene vrijednosti poput adrese pametnog ugovora i Google Client ID-a mogu biti javno dostupne jer ne predstavljaju sigurnosni rizik.
Važno je napomenuti da varijable okruženja u frontend dijelu aplikacije ne sadrže povjerljive podatke jer se učitavaju u korisnički preglednik. Ipak, kod RPC adrese preporučuje se oprez jer javno izlaganje može dovesti do neželjenog korištenja i ograničenja pristupa od strane pružatelja usluge.
Pribavljanje konfiguracijskih podataka 
Za pravilno funkcioniranje aplikacije potrebno je pribaviti sljedeće podatke:
•	Sepolia RPC URL dobiva se registracijom na servisima poput Infura ili Alchemy, gdje se nakon izrade projekta generira pristupna adresa za komunikaciju s Ethereum Sepolia mrežom. 
•	Privatni ključevi generiraju se putem kripto novčanika (npr. MetaMask) i koriste se za potpisivanje transakcija na blockchain mreži. 
•	Testni ETH dobiva se putem faucet servisa za Sepolia mrežu te je potreban za izvršavanje transakcija i plaćanje troškova (gas). U slučaju korištenja lokalne Hardhat mreže, testni ETH nije potreban jer su računi unaprijed financirani.

6.6.2. Kompilacija i implementacija pametnog ugovora
Pametni ugovor potrebno je najprije kompilirati, a zatim implementirati na Sepolia testnu mrežu korištenjem Hardhat okruženja. U projektu se za implementaciju koristi skripta deploy-sepolia-raw.js.

									cd voting-app-masters
									npx hardhat compile
									npx hardhat run scripts/deploy-sepolia-raw.js --network sepolia

Nakon uspješne implementacije potrebno je zabilježiti adresu pametnog ugovora i upisati je u frontend konfiguraciju kao VITE_CONTRACT_ADDRESS.

6.6.3. Pokretanje aplikacije
Aplikacija se pokreće u dva koraka: najprije aplikacijski poslužitelj, a zatim korisničko sučelje.

									cd backend
									node server.js
									"pokretanje backend-a"

									cd frontend
									npm run dev
									"pokretanje frontend-a"
Nakon pokretanja aplikacija je dostupna putem lokalne adrese u pregledniku, gdje korisnik može izvršiti prijavu, sudjelovati u glasanju i pregledati rezultate.

