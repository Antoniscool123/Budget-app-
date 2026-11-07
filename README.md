# Kroner — budget-app med kvitteringsscanning

En komplet budget-app i browseren: **scan kvitteringen, og beløbet bliver læst automatisk**.
Ingen manuel indtastning, ingen server, ingen konto. Sæt dit månedlige beløb, og appen regner
ud, hvad du kan bruge hver dag.

> Bygget med React + TypeScript + Vite og pakket til Android med Capacitor. OCR kører 100 % lokalt
> på enheden med Tesseract.js — dine kvitteringer uploades aldrig. Designet er minimalistisk og
> trækker på One UI 9's formsprog.

📱 **[Download Android-appen (APK)](https://github.com/Antoniscool123/Budget-app-/releases/download/apk/kroner.apk)** — virker uden netværk og uden konto.

<p align="center">
  <img src="docs/kroner-apk-qr.png" alt="QR-kode til APK-download" width="220" />
  <br />
  <em>Scan med telefonens kamera for at hente APK'en</em>
</p>

---

## Funktioner

### 🎨 Minimalistisk design, bygget til One UI 9
- Rolig, flad flade med **store bløde kort (28–30 px)**, rigelig luft og **én blå accentfarve**
  — ingen gradienter, glød eller dekorative rammer.
- **Runde "pill"-knapper**, segmenterede vælgere og diskrete chips i stedet for tunge formularer.
- På telefonen: **bundnavigation**, **bottom sheets** med håndtag i stedet for modaler, og en rund
  scan-knap, så tommelen når alt.
- Mørk tilstand er **helt sort** med løftede kort — som på One UI. Nyt app-ikon i samme blå farve.

### 💡 Indsigter, der hjælper dig videre
- Kortet **"Værd at vide"** på overblikket fremhæver det vigtigste lige nu: er du foran planen,
  bruger du mere end sidste måned, er en kategori steget, fylder faste udgifter meget — eller er
  det tid til en backup. Hvert punkt har et direkte genvej til det sted, hvor du kan handle.

### 🚀 Kom hurtigt i gang
- **Introduktion i to trin** ved første besøg: sæt dit månedsbeløb, og vælg derefter scan, manuel
  indtastning eller eksempeldata.
- **"Du kan bruge X kr om dagen"** står nu øverst på overblikket — det tal man reelt bruger.
- **Hurtigt valg** af de butikker du bruger mest, når du taster en udgift manuelt, og
  **"Gem & ny"**, så du kan taste flere udgifter i træk uden at åbne vinduet igen.
- **Dato med ét tryk**: "I dag" eller "I går" i stedet for datovælger.
- **Tastaturgenveje** på computeren (`N` = ny udgift, `S` = scan, `←`/`→` = skift måned) og
  **swipe** mellem måneder på telefonen.

### 🧾 Scan kvitteringer — uden at taste beløb
- Tag et billede med kameraet eller slip et billede ind (jpg/png/webp).
- Appen finder selv **totalen**, **datoen**, **butikken**, **kategorien** og **varelinjerne**.
- Forstår danske boner: `I ALT`, `AT BETALE`, `TOTAL`, `MOMS 25 %`, `DANKORT`, `BYTTE`,
  tusindtal (`1.234,56`), datoer (`04-11-2026`, `1. nov 2026`, `2026-11-04`) og danske butikskæder
  (Netto, REMA 1000, føtex, Lidl, Bilka, Apotek, DSB, Circle K …).
- Viser hvor sikker læsningen er, og hvilke regler der gav resultatet — så du kan stole på det.
- Kan læse kvitteringen på to måder; hvis det første forsøg ikke finder et beløb, prøver appen
  automatisk en anden billedopdeling.
- **Læs igen / Rotér & læs**: gik billedet galt, kan du genlæse uden at uploade forfra.
- **Dublet-tjek**: appen advarer, hvis du er ved at gemme samme beløb fra samme butik igen.
- **Kategorihukommelse**: retter du én gang kategorien for en butik, bruger appen den næste gang.
- **Flere boner på én gang**: vælg eller slip flere billeder, og appen læser dem én ad gangen
  ("Bon 2 af 3"), så du slipper for at starte forfra hver gang.
- Fandt OCR'en intet beløb, står markøren klar i beløbsfeltet.
- **Robust motorstart**: wasm- og sprogfilerne ligger ved siden af Tesseract-workeren (motoren slår
  sin `.wasm` op relativt til workerens placering), og hvis klargøringen fejler, vises en konkret
  fejlbesked med "Vis detaljer" — i stedet for en scanning der bare venter.
- **Hurtig første scanning**: tekstmotoren klargøres i baggrunden, allerede når appen åbnes, så
  wasm og den danske sprogmodel er klar inden du vælger billede. Undervejs viser appen status
  ("Klargør scanneren"), sekundtæller og en genvej til manuel indtastning, hvis det trækker ud.
- **Alt behandles lokalt**: billedet forlader aldrig enheden, og der bruges ingen API-nøgler.

### 🎯 Månedligt budget
- Sæt ét samlet beløb for måneden — eller brug et af forslagene (5.000 / 8.000 / 10.000 / 15.000 kr).
- Fordel automatisk på kategorier med ét tryk, eller sæt dine egne lofter pr. kategori.
- Budgettet huskes pr. måned og **arves automatisk** til næste måned.
- Se hvor meget du kan bruge pr. dag resten af måneden, og om du er foran eller bagud planen.

### 📊 Overblik og historik
- Stort tal for det du har tilbage, tynd fremdriftslinje og procent brugt.
- **Faste udgifter** findes automatisk (husleje, streaming, medlemskaber) med månedlig total.
- Kategori-visning med fremdriftsbjælker og advarsel, når et loft er nået.
- "Brugt i dag", "største udgift" og "mest brugt på".
- 6-måneders trendgraf med budgetmarkering pr. måned.
- Fuldt søgbar historik — også **på tværs af alle måneder** — med kategorifiltre, dagssummer og
  detaljevisning med kvitteringsbillede.

### ♿ Tilgængelighed
- "Spring til indhold"-link, fokus-fælde i vinduer, synlig fokusmarkering og skærmlæser-opdatering
  når du skifter måned.
- Store trykflader (mindst 40 px) og respekt for `prefers-reduced-motion`.

### 📱 På telefonen
- Samme app som Android-app (APK), med kamera-scanning direkte fra lommen.
- Kvitteringsmotoren og sprogmodellen ligger i APK'en, så scanningen virker offline.
- Android-tilbageknappen lukker modaler og går til Overblik i stedet for at lukke appen.

### 🔒 Dine data
- Alt gemmes lokalt i browseren (localStorage + IndexedDB til billeder).
- Backup og gendannelse som JSON, eksport til CSV (Excel-venlig med `;`).
- Viser hvor meget lagerplads data bruger, og advarer før det løber op.
- **Backup-status** med dato, så du ved, hvornår data sidst blev sikret.
- Lys/mørk tilstand, valuta (DKK/EUR/SEK/NOK) og "slet alle data".
- Eksempeldata med ét tryk, hvis du vil se appen fyldt ud.

---

## 📱 Android-app (APK)

Appen findes også som rigtig Android-app, så du kan scanne kvitteringer direkte fra telefonen.

**Download:** [kroner.apk](https://github.com/Antoniscool123/Budget-app-/releases/download/apk/kroner.apk)
(alle versioner ligger under [Releases](https://github.com/Antoniscool123/Budget-app-/releases))

Sådan installerer du den:
1. Åbn linket på din Android-telefon.
2. Tryk på den downloadede `kroner.apk`.
3. Tillad "Installér ukendte apps", hvis telefonen spørger (gælder kun browseren/appen, du henter fra).
4. Åbn **Kroner** — data bliver på telefonen.

APK'en er en **debug-signeret testbygning**, ikke en Play Store-udgivelse. Den bygges
automatisk af GitHub Actions (`.github/workflows/android.yml`) ved hver ændring på `main`:

```bash
npm run android:sync     # byg web-appen og kopiér den ind i Android-projektet
npm run android:apk      # byg APK lokalt (kræver JDK 17 + Android SDK)
npm run android:open     # åbn projektet i Android Studio
npm run android:assets   # genskab launcher-ikoner og splash fra public/icon.svg
```

Projektet ligger i `android/` og kan åbnes direkte i Android Studio. App-id: `dk.kroner.budget`.

---

## Kom i gang

```bash
npm install     # installerer også OCR-motoren i public/ (se nedenfor)
npm run dev     # http://localhost:5173
```

Åbn appen, tryk **Scan kvittering** → **Prøv med eksempel** for at se hele flowet med det samme.

### Scripts

| Kommando | Beskrivelse |
| --- | --- |
| `npm run dev` | Udviklingsserver |
| `npm run build` | Produktionsbuild i `dist/` |
| `npm run preview` | Serverer produktionsbuildet |
| `npm test` | Kører alle tests (Vitest) |
| `npm run typecheck` | TypeScript-check uden at bygge |

### Om OCR-filerne

Tesseract-motoren, wasm-kernen og den danske sprogmodel hentes fra npm-pakker og kopieres ind i
`public/` af `scripts/setup-ocr.mjs` (kører automatisk ved `install`, `dev` og `build`).
Filerne er **ikke** i git, så repoet forbliver let — men appen serverer dem selv, og virker
derfor uden CDN'er, uden API-nøgler og (efter første indlæsning) uden netværk.

---

## Sådan læses en kvittering

Hele kæden ligger i `src/lib`:

1. **`image.ts`** — billedet skaleres ned, laves i gråskala og får strakt kontrast (percentil-baseret),
   hvilket giver mærkbart bedre tal-genkendelse.
2. **`ocr.ts`** — Tesseract.js kører i en web worker med `SINGLE_COLUMN`-opdeling og
   `preserve_interword_spaces`. Ordene har bounding boxes, og `rebuildLinesFromWords()` samler dem
   igen efter lodret placering. Det er afgørende: Tesseract deler ellers nemt en bon i to spalter
   (alle varenavne først, alle beløb bagefter), så `VARE 12,95` bliver til to linjer.
3. **`receiptParser.ts`** — finder totalen med vægtede nøgleord og "guard"-regler (moms, rabat,
   dankort, bytte må ikke blive totalen), læser dato i flere formater, genkender butikskæder,
   udleder kategori og parser varelinjer. Mangler totalen, summeres varerne; og hvis momsbeløbet
   stemmer med 25 %, stiger sikkerheden.
4. **`ScanPage.tsx`** — viser resultatet i en formular, du kan rette i, og gemmer.

Parserens regelsæt er dækket af tests (`src/lib/receiptParser.test.ts`) med rigtige bon-eksempler.

---

## Projektstruktur

```
android/                  # Capacitor-projekt (bygger APK)
capacitor.config.ts       # app-id, navn og web-mappe
scripts/
  setup-ocr.mjs           # kopierer OCR-motoren ind i public/
  generate-android-assets.mjs  # launcher-ikoner + splash
public/
  demo/kvittering.jpg     # eksempel-bon til "prøv med eksempel"
  manifest.webmanifest    # installerbar web-app
src/
  components/             # UI: modaler, ring, trendgraf, ikoner …
  data/categories.ts      # kategorier, farver og nøgleord
  lib/
    budget.ts             # opsummering pr. måned, kategorifordeling
    dates.ts              # månedsnøgler, dage tilbage, fremdrift
    demo.ts               # seedede eksempeldata
    format.ts             # kroner/formatering + dansk tal-parsing
    image.ts              # billedforbedring før OCR
    imageStore.ts         # kvitteringsbilleder i IndexedDB
    ocr.ts                # Tesseract + linjesammenlægning
    receiptParser.ts      # den danske kvitteringsparser
    storage.ts            # localStorage, standardbudget, nedarvning
  pages/                  # Overblik, Scan, Budget, Historik
  store/                  # app-state (context) og toasts
```

---

## Test

```bash
npm test
```

55 tests dækker talformat, kvitteringsparsing (dansk, engelsk, tusindtal, manglende total,
datoformater, kategori), budgetmatematik, månedsarv, faste udgifter, dubletter,
kategorihukommelse, indsigter, at OCR-motoren startes med sproget som navn
(og sprogmodellen i Tesseracts cache), og hele UI-flowet (onboarding, budget, manuel indtastning, "Gem & ny",
dato-hurtigvalg, indstillinger, historik) i jsdom.

---

## Deploy

**GitHub Pages** (workflowet `.github/workflows/deploy.yml` er klar):
1. Gå til **Settings → Pages** og vælg **GitHub Actions** som kilde.
2. Start workflowet **Deploy til GitHub Pages** fra Actions-fanen — appen bygges med den rigtige
   base-sti og deployes til `https://<bruger>.github.io/<repo>/`.

**Vercel / Netlify:** importér repoet, build-kommando `npm run build`, output-mappe `dist`.
Ingen miljøvariabler eller server kræves.

**Android:** `.github/workflows/android.yml` bygger APK'en og lægger den på release-tagget `apk`,
så downloadlinket altid er det samme.

Vil du køre appen på en undermappe, så sæt `BASE_PATH=/mit-repo/` ved build.

---

## Kendte begrænsninger

- OCR er bedst på flade, skarpe billeder i godt lys. Vinklede og meget krøllede boner kan give
  fejl i varelinjerne — totalen findes dog oftest stadig, og du kan altid rette beløbet.
- Valutaomregning bruger faste kurser (til visning); beløb gemmes altid i kroner.
- Data ligger i browseren. Skifter du enhed eller rydder browserdata, skal du bruge backup-filen.

## Mulige næste skridt

Indtægter og opsparing, flere kvitteringer i kø, deling via delingslink, budgetforslag ud fra
indkomst, og notifikationer når et kategoriloft er nået.
