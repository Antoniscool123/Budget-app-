# Kroner — budget-app med kvitteringsscanning

En komplet budget-app i browseren: **scan kvitteringen, og beløbet bliver læst automatisk**.
Ingen manuel indtastning, ingen server, ingen konto. Sæt dit månedlige beløb, og appen regner
ud, hvad du kan bruge hver dag.

> Bygget med React + TypeScript + Vite. OCR kører 100 % lokalt i browseren med Tesseract.js —
> dine kvitteringer uploades aldrig.

---

## Funktioner

### 🧾 Scan kvitteringer — uden at taste beløb
- Tag et billede med kameraet eller slip et billede ind (jpg/png/webp).
- Appen finder selv **totalen**, **datoen**, **butikken**, **kategorien** og **varelinjerne**.
- Forstår danske boner: `I ALT`, `AT BETALE`, `TOTAL`, `MOMS 25 %`, `DANKORT`, `BYTTE`,
  tusindtal (`1.234,56`), datoer (`04-11-2026`, `1. nov 2026`, `2026-11-04`) og danske butikskæder
  (Netto, REMA 1000, føtex, Lidl, Bilka, Apotek, DSB, Circle K …).
- Viser hvor sikker læsningen er, og hvilke regler der gav resultatet — så du kan stole på det.
- Kan læse kvitteringen på to måder; hvis det første forsøg ikke finder et beløb, prøver appen
  automatisk en anden billedopdeling.
- **Alt behandles lokalt**: billedet forlader aldrig enheden, og der bruges ingen API-nøgler.

### 🎯 Månedligt budget
- Sæt ét samlet beløb for måneden — eller brug et af forslagene (5.000 / 8.000 / 10.000 / 15.000 kr).
- Fordel automatisk på kategorier med ét tryk, eller sæt dine egne lofter pr. kategori.
- Budgettet huskes pr. måned og **arves automatisk** til næste måned.
- Se hvor meget du kan bruge pr. dag resten af måneden, og om du er foran eller bagud planen.

### 📊 Overblik og historik
- Stor fremdriftsring: tilbage af budgettet, procent brugt, dage tilbage.
- Kategori-visning med fremdriftsbjælker og advarsel, når et loft er nået.
- "Brugt i dag", "største udgift" og "mest brugt på".
- 6-måneders trendgraf med budgetmarkering pr. måned.
- Fuldt søgbar historik, filtre pr. kategori, dagssummer og detaljevisning med kvitteringsbillede.

### 🔒 Dine data
- Alt gemmes lokalt i browseren (localStorage + IndexedDB til billeder).
- Backup og gendannelse som JSON, eksport til CSV (Excel-venlig med `;`).
- Lys/mørk tilstand, valuta (DKK/EUR/SEK/NOK) og "slet alle data".
- Eksempeldata med ét tryk, hvis du vil se appen fyldt ud.

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

26 tests dækker talformat, kvitteringsparsing (dansk, engelsk, tusindtal, manglende total,
datoformater, kategori), budgetmatematik, månedsarv og en røgtest af hele UI'et i jsdom.

---

## Deploy

**GitHub Pages** (workflowet `.github/workflows/deploy.yml` er klar):
1. Gå til **Settings → Pages** og vælg **GitHub Actions** som kilde.
2. Push til `main` — appen bygges med den rigtige base-sti og deployes.

**Vercel / Netlify:** importér repoet, build-kommando `npm run build`, output-mappe `dist`.
Ingen miljøvariabler eller server kræves.

Vil du køre appen på en undermappe, så sæt `BASE_PATH=/mit-repo/` ved build.

---

## Kendte begrænsninger

- OCR er bedst på flade, skarpe billeder i godt lys. Vinklede og meget krøllede boner kan give
  fejl i varelinjerne — totalen findes dog oftest stadig, og du kan altid rette beløbet.
- Valutaomregning bruger faste kurser (til visning); beløb gemmes altid i kroner.
- Data ligger i browseren. Skifter du enhed eller rydder browserdata, skal du bruge backup-filen.

## Mulige næste skridt

Tilbagevendende udgifter, indtægter og opsparing, flere kvitteringer ad gangen, deling via
delingslink, og automatisk kategorisering der lærer af dine rettelser.
