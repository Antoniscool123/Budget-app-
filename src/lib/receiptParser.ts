import type { CategoryId, ParsedReceipt, ReceiptItem } from '../types';
import { CATEGORIES } from '../data/categories';
import { parseAmountString } from './format';
import { toISODate } from './dates';

/**
 * Parser til danske (og skandinaviske) butikskvitteringer.
 *
 * Den er bygget i lag, så den også giver et brugbart resultat når OCR'en
 * støjer:
 *   1. Normalisér teksten (OCR-tegn, mellemrum, linjeskift)
 *   2. Find totalen ud fra nøgleord som "I ALT", "TOTAL", "AT BETALE"
 *   3. Find dato, butik og varelinjer
 *   4. Gæt kategori ud fra butik og varetekst
 *   5. Regn en confidence ud, så UI'et kan sige hvor sikker læsningen er
 */

const TOTAL_KEYWORDS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\b(AT\s+BETALE|TIL\s+BETALING|TILBETALING)\b/, weight: 120, label: 'fandt "at betale"' },
  { pattern: /\b(I\s*ALT|IALT)\b/, weight: 110, label: 'fandt "i alt"' },
  { pattern: /\b(TOTALT|TOTAL|ATT\s+BETALA)\b/, weight: 100, label: 'fandt "total"' },
  { pattern: /\b(TIL\s+SAMMEN|SAMMENLAGT)\b/, weight: 95, label: 'fandt "til sammen"' },
  { pattern: /\b(BELØB|BELOB|AMOUNT\s+DUE)\b/, weight: 80, label: 'fandt "beløb"' },
  { pattern: /\b(SUM|SUMME)\b/, weight: 70, label: 'fandt "sum"' },
  { pattern: /\b(AMOUNT|GRAND\s+TOTAL)\b/, weight: 90, label: 'fandt engelsk total' },
];

/** Linjer der aldrig er totalen. */
const GUARD_PATTERNS = [
  /MOMS/, /MVA/, /HERAF/, /HERAF/, /RABAT/, /SPAR/, /BONUS/, /RETUR/, /RETURNERET/,
  /BYTTE/, /KONTANT/, /DANKORT/, /KORT\b/, /VEXL/, /VEKSL/, /CHANGE/, /CASH/, /POINT/,
  /SALDO/, /ØRE\b/, /ØRES/, /ANTAL/, /STK/, /PRIS/, /TILGODE/, /GAVEKORT/, /BETALT/,
  /VALUTA/, /OMREGNING/, /RENDE/, /AFRUNDET/, /TIDLIGERE/,
];

const NON_ITEM_PATTERNS = [
  /MOMS/, /MVA/, /HERAF/, /HERAF/, /RABAT/, /SPAR/, /BONUS/, /RETUR/, /RETURNERET/,
  /BYTTE/, /KONTANT/, /DANKORT/, /KORT\b/, /VEXL/, /VEKSL/, /CHANGE/, /CASH/, /POINT/,
  /SALDO/, /ØRES/, /ANTAL/, /PRIS/, /TILGODE/, /GAVEKORT/, /VALUTA/, /AFRUNDET/,
  /TOTAL/, /I\s*ALT/, /ALT\s+I/, /SUM/, /BELØB/, /KASSE/, /DATO/, /TID\b/, /KL\./,
  /CVR/, /SE\s*NR/, /TELEFON/, /TEL\b/, /FAKTURA/, /KVITTERING/, /BON\b/, /MEDARBEJDER/,
  /KORTNR/, /TERMINAL/, /AUT\./, /KUNDE/, /ORDRE/, /LEVERING/, /FRAGT/, /GEBYR/,
];

const DATE_LINE_HINTS = /(DATO|DATE|UDSTED|TIDSPUNKT)/;
const MONTHS: Record<string, number> = {
  JAN: 1, JANUAR: 1, FEB: 2, FEBRUAR: 2, MAR: 3, MARTS: 3, APR: 4, APRIL: 4,
  MAJ: 5, MAY: 5, JUN: 6, JUNI: 6, JUL: 7, JULI: 7, AUG: 8, AUGUST: 8,
  SEP: 9, SEPT: 9, SEPTEMBER: 9, OKT: 10, OCT: 10, OKTOBER: 10, NOV: 11,
  NOVEMBER: 11, DEC: 12, DES: 12, DECEMBER: 12,
};

const MERCHANT_NOISE =
  /(KVITTERING|KASSER?BON|BON\b|FAKTURA|NOTA|RECEIPT|VELKOMMEN|TAK FOR|MEDARBEJDER|KASSE|CVR|SE-?NR|TEL|TLF|TELEFON|WWW\.|HTTPS?:|@|ÅBNINGSTID|DATO|KL\.|SALG|TILBUD|KUNDE|BETALING|MOBILEPAY)/;

/** Butikskæder → kategori. Rækkefølgen betyder noget: mest specifikke først. */
const BRANDS: Array<{ pattern: RegExp; name: string; category: CategoryId }> = [
  { pattern: /\b(REMA\s*1000|REMA)\b/, name: 'REMA 1000', category: 'dagligvarer' },
  { pattern: /\bNETTO\b/, name: 'Netto', category: 'dagligvarer' },
  { pattern: /\b(FØTEX|FOTEX)\b/, name: 'føtex', category: 'dagligvarer' },
  { pattern: /\bBILKA\b/, name: 'Bilka', category: 'dagligvarer' },
  { pattern: /\bLIDL\b/, name: 'Lidl', category: 'dagligvarer' },
  { pattern: /\bALDI\b/, name: 'Aldi', category: 'dagligvarer' },
  { pattern: /\bIRMA\b/, name: 'Irma', category: 'dagligvarer' },
  { pattern: /\b(SUPERBRUGSEN|SUPER\s*BRUGSEN)\b/, name: 'SuperBrugsen', category: 'dagligvarer' },
  { pattern: /\b(DAGLI'?BRUGSEN)\b/, name: "Dagli'Brugsen", category: 'dagligvarer' },
  { pattern: /\bKVICKLY\b/, name: 'Kvickly', category: 'dagligvarer' },
  { pattern: /\b(COOP\s*365|365\s*DISCOUNT)\b/, name: 'Coop 365', category: 'dagligvarer' },
  { pattern: /\bMENY\b/, name: 'Meny', category: 'dagligvarer' },
  { pattern: /\b(SPAR|MIN\s*KØBMAND|NÆRKØB)\b/, name: 'SPAR', category: 'dagligvarer' },
  { pattern: /\bFAKTA\b/, name: 'Fakta', category: 'dagligvarer' },
  { pattern: /\b(ABC\s*LAVPRIS|LØVBJERG|INCO|HELSAM)\b/, name: 'Dagligvarer', category: 'dagligvarer' },
  { pattern: /\b7-?\s*ELEVEN\b/, name: '7-Eleven', category: 'dagligvarer' },
  { pattern: /\b(MCDONALD|MCD)\b/, name: "McDonald's", category: 'restaurant' },
  { pattern: /\bBURGER\s*KING\b/, name: 'Burger King', category: 'restaurant' },
  { pattern: /\b(SUNSET\s*BOULEVARD)\b/, name: 'Sunset Boulevard', category: 'restaurant' },
  { pattern: /\bJOE\s*(&|AND|OG)\s*THE\s*JUICE\b/, name: 'Joe & The Juice', category: 'restaurant' },
  { pattern: /\bSTARBUCKS\b/, name: 'Starbucks', category: 'restaurant' },
  { pattern: /\b(ESPRESSO\s*HOUSE|BAARESSO)\b/, name: 'Espresso House', category: 'restaurant' },
  { pattern: /\bJUST\s*EAT\b/, name: 'Just Eat', category: 'restaurant' },
  { pattern: /\bWOLT\b/, name: 'Wolt', category: 'restaurant' },
  { pattern: /\b(SHELL|CIRCLE\s*K|Q8|UNO-?X|F24|INGO|OK\s*BENZIN)\b/, name: 'Tankstation', category: 'transport' },
  { pattern: /\b(DSB|REJSEKORT|MOVIA|ARRIVA)\b/, name: 'DSB', category: 'transport' },
  { pattern: /\b(Q-?PARK|EASYPARK|APCOA)\b/, name: 'Parkering', category: 'transport' },
  { pattern: /\b(UBER|BOLT|TAXA|TAXI)\b/, name: 'Taxa', category: 'transport' },
  { pattern: /\bELGIGANTEN\b/, name: 'Elgiganten', category: 'shopping' },
  { pattern: /\b(POWER|JYSK|IKEA|HARALD\s*NYBORG|SILVAN|BAUHAUS|BILTEMA|THANSEN)\b/, name: 'Indkøb', category: 'shopping' },
  { pattern: /\b(NORMAL|MATAS|H&M|ZARA|ZALANDO|SPORT\s*24|SPORTMASTER|STADIUM|MAGASIN)\b/, name: 'Shopping', category: 'shopping' },
  { pattern: /\b(FITNESS\s*WORLD|SATs?|LOOP|SVØMMEHAL)\b/, name: 'Fitness', category: 'fritid' },
  { pattern: /\b(NORDISK\s*FILM|CINEMA|BIOGRAF|TIVOLI|ZOO)\b/, name: 'Oplevelser', category: 'fritid' },
  { pattern: /\b(SPOTIFY|NETFLIX|DISNEY|HBO|STORYTEL|MOFIBO|STEAM)\b/, name: 'Abonnement', category: 'fritid' },
  { pattern: /\b(APOTEK|APOTEKET)\b/, name: 'Apotek', category: 'sundhed' },
  { pattern: /\b(TANDLÆGE|LÆGE|LÆGEHUS|FYSIOTERAPI|PSYKOLOG)\b/, name: 'Sundhed', category: 'sundhed' },
  { pattern: /\b(HOTEL|AIRBNB|BOOKING\.COM|SAS|NORWEGIAN|RYANAIR|EASYJET)\b/, name: 'Rejse', category: 'rejser' },
  { pattern: /\b(NORLYS|ØRSTED|ORSTED|ANDEL\s*ENERGI)\b/, name: 'Energi', category: 'bolig' },
  { pattern: /\b(TELMORE|YOUSEE|TELIA|OISTER|CBB|TDC)\b/, name: 'Telefoni', category: 'bolig' },
];

const MONEY_TOKEN = /-?\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}|-?\d{1,3}(?:[.\s]\d{3})+(?!\d)|-?\d+[.,]\d{2}/g;
const DATE_LIKE = /\b\d{1,4}[./-]\d{1,2}[./-]\d{2,4}\b/g;

function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u2007\u202f\u2009]/g, ' ')
    .replace(/[|¦]/g, ' ')
    .replace(/[’‘´`]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[•·]/g, ' ')
    .replace(/[ \t]{2,}/g, '  ')
    .trim();
}

function toLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/\s{3,}/g, '  ').trim())
    .filter((line) => line.length > 0);
}

/** Fjerner datoer fra en linje, så tallene i datoen ikke bliver læst som beløb. */
function stripDates(line: string): string {
  return line.replace(DATE_LIKE, ' ');
}

function amountsInLine(line: string): number[] {
  const cleaned = stripDates(line).replace(/[%]/g, ' ');
  const matches = cleaned.match(MONEY_TOKEN) ?? [];
  return matches
    .map((token) => parseAmountString(token))
    .filter((value): value is number => value !== null && Number.isFinite(value));
}

function hasLetters(value: string): boolean {
  return /[\p{L}]{2,}/u.test(value);
}

function isGuarded(line: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(line));
}

function sentenceCase(name: string): string {
  const cleaned = name
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s*#=-]+/, '')
    .replace(/[\s*#=-]+$/, '')
    .replace(/\s+[A-Z]{2}$/, '') // moms-kode til sidst
    .trim();
  if (!cleaned) return cleaned;
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    const lower = cleaned.toLocaleLowerCase('da-DK');
    return lower.charAt(0).toLocaleUpperCase('da-DK') + lower.slice(1);
  }
  return cleaned;
}

interface TotalMatch {
  amount: number;
  index: number;
  weight: number;
  label: string;
}

function findTotal(lines: string[]): TotalMatch | null {
  let best: TotalMatch | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].toUpperCase();

    const keyword = TOTAL_KEYWORDS.find((k) => k.pattern.test(line));
    if (!keyword) continue;

    // "Moms 25% af 100,00" må ikke blive totalen, medmindre linjen også siger total.
    const guarded = isGuarded(line, GUARD_PATTERNS) && !/(AT\s+BETALE|I\s*ALT|TOTAL)/.test(line);
    if (guarded) continue;

    const ownAmounts = amountsInLine(lines[i]);
    let amount = ownAmounts.length > 0 ? ownAmounts[ownAmounts.length - 1] : null;

    // Nogle kvitteringer sætter beløbet på linjen under ("I ALT" / "1.234,56").
    // Vi springer linjer som moms, dankort og bytte over.
    if (amount === null) {
      for (let j = 1; j <= 4 && i + j < lines.length; j += 1) {
        const next = lines[i + j];
        const nextUpper = next.toUpperCase();
        if (!/\d/.test(next)) continue;
        if (isGuarded(nextUpper, GUARD_PATTERNS)) continue;
        const nextAmounts = amountsInLine(next);
        if (nextAmounts.length === 0) continue;
        if (!hasLetters(next)) {
          amount = nextAmounts[0];
          break;
        }
        // Sidste udvej: én linje med præcis ét beløb og et ord som "SUM"/"TOTAL".
        if (nextAmounts.length === 1 && TOTAL_KEYWORDS.some((k) => k.pattern.test(nextUpper))) {
          amount = nextAmounts[0];
          break;
        }
      }
    }

    if (amount === null || amount <= 0 || amount > 500000) continue;

    const candidate: TotalMatch = { amount, index: i, weight: keyword.weight, label: keyword.label };
    // Ved lige gode kandidater vælges den sidste — totalen står nederst på bonen.
    if (!best || candidate.weight > best.weight || (candidate.weight === best.weight && candidate.index >= best.index)) {
      best = candidate;
    }
  }

  return best;
}

function findMoms(lines: string[]): number | null {
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (!/MOMS|MVA/.test(upper)) continue;
    const amounts = amountsInLine(line);
    if (amounts.length === 0) continue;
    // Moms-linjen kan hedde "Moms 25% 246,90" — tag det sidste beløb.
    return amounts[amounts.length - 1];
  }
  return null;
}

function buildDate(year: number, month: number, day: number): string | null {
  const now = new Date();
  if (year < 2000) year += 2000;
  if (year > now.getFullYear() + 1) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const candidate = new Date(year, month - 1, day);
  if (candidate.getMonth() !== month - 1) return null;
  // Datoer langt ude i fremtiden er nok udløbsdatoer.
  const maxDate = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 60);
  if (candidate > maxDate) return null;
  return toISODate(candidate);
}

function findDate(lines: string[]): { date: string; label: string } | null {
  const candidates: Array<{ date: string; label: string; score: number }> = [];

  lines.forEach((line, index) => {
    const upper = line.toUpperCase();
    const proximity = DATE_LINE_HINTS.test(upper) ? 40 : 0;
    const early = index < 6 ? 12 : 0;

    // 2026-11-01
    const iso = upper.match(/\b(\d{4})[-./](\d{1,2})[-./](\d{1,2})\b/);
    if (iso) {
      const date = buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
      if (date) candidates.push({ date, label: 'fandt dato (ISO)', score: 80 + proximity + early });
    }

    // 01-11-2026 / 01.11.26 / 01/11 2026
    const dmy = upper.match(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\b/);
    if (dmy) {
      const date = buildDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
      if (date) candidates.push({ date, label: 'fandt dato', score: 85 + proximity + early });
      else {
        // Amerikansk rækkefølge: MM/DD/YYYY
        const usDate = buildDate(Number(dmy[3]), Number(dmy[1]), Number(dmy[2]));
        if (usDate) candidates.push({ date: usDate, label: 'fandt dato', score: 55 + proximity });
      }
    }

    // 01. NOV 2026 / 1 NOVEMBER 26
    const named = upper.match(/\b(\d{1,2})[.\s-]*([A-ZÆØÅ]{3,9})[.\s-]*(\d{2,4})\b/);
    if (named && MONTHS[named[2]]) {
      const date = buildDate(Number(named[3]), MONTHS[named[2]], Number(named[1]));
      if (date) candidates.push({ date, label: 'fandt dato med månedsnavn', score: 88 + proximity });
    }

    // NOV 01, 2026
    const usNamed = upper.match(/\b([A-ZÆØÅ]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
    if (usNamed && MONTHS[usNamed[1]]) {
      const date = buildDate(Number(usNamed[3]), MONTHS[usNamed[1]], Number(usNamed[2]));
      if (date) candidates.push({ date, label: 'fandt dato med månedsnavn', score: 70 });
    }

    // Kort form uden år: 01.11 / 01-11
    if (!dmy) {
      const short = upper.match(/\b(\d{1,2})[.\-/](\d{1,2})\b(?![.\-/]\d)/);
      if (short && proximity > 0) {
        const date = buildDate(new Date().getFullYear(), Number(short[2]), Number(short[1]));
        if (date) candidates.push({ date, label: 'fandt dato uden årstal', score: 45 + proximity });
      }
    }
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return { date: candidates[0].date, label: candidates[0].label };
}

function findMerchant(lines: string[], fullText: string): { merchant?: string; brandCategory?: CategoryId; label?: string } {
  const upper = fullText.toUpperCase();
  let bestBrand: { name: string; category: CategoryId; at: number } | null = null;

  for (const brand of BRANDS) {
    const match = brand.pattern.exec(upper);
    if (!match) continue;
    if (!bestBrand || match.index < bestBrand.at) {
      bestBrand = { name: brand.name, category: brand.category, at: match.index };
    }
  }

  if (bestBrand) {
    return { merchant: bestBrand.name, brandCategory: bestBrand.category, label: 'genkendte butikskæden' };
  }

  for (const line of lines.slice(0, 8)) {
    const cleaned = line.replace(/[*#=]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (cleaned.length < 3 || cleaned.length > 42) continue;
    if (MERCHANT_NOISE.test(cleaned.toUpperCase())) continue;
    if (!hasLetters(cleaned)) continue;
    if (/^\d/.test(cleaned)) continue;
    if (/^[\d\s.,:/-]+$/.test(cleaned)) continue;
    const letters = cleaned.replace(/[^\p{L}]/gu, '');
    if (letters.length < 3) continue;
    return {
      merchant: sentenceCase(cleaned),
      label: 'brugte øverste linje som butiksnavn',
    };
  }

  return {};
}

function findItems(lines: string[], totalIndex: number | null): ReceiptItem[] {
  const items: ReceiptItem[] = [];
  const itemLine = /^(.*?[\p{L}].*?)\s{1,}(-?\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}|-?\d+[.,]\d{2})\s*(?:[A-Z]{1,3}|\*)?$/u;

  lines.forEach((rawLine, index) => {
    if (totalIndex !== null && index === totalIndex) return;
    const line = rawLine.replace(/\s{2,}/g, ' ').trim();
    const upper = line.toUpperCase();
    if (isGuarded(upper, NON_ITEM_PATTERNS)) return;
    if (line.length > 60) return;

    const match = line.match(itemLine);
    if (!match) return;

    const [, rawName, rawAmount] = match;
    const amount = parseAmountString(rawAmount);
    if (amount === null || amount === 0 || Math.abs(amount) > 100000) return;

    const name = sentenceCase(
      rawName
        .replace(/^\s*\d+\s*(x|stk\.?|pcs)\s*/i, '')
        .replace(/\s+@\s*.*$/, '')
        .trim(),
    );
    if (!name || name.length < 2 || !/[\p{L}]{2,}/u.test(name)) return;
    if (/^(TOTAL|MOMS|SUM|I ALT|KORT|KONTANT)$/i.test(name)) return;

    items.push({ name, amount });
  });

  return items.slice(0, 40);
}

function guessCategory(text: string, brandCategory?: CategoryId): { category: CategoryId; label: string } {
  if (brandCategory) return { category: brandCategory, label: 'kategori fra butikskæden' };

  const haystack = text.toLocaleLowerCase('da-DK');
  let best: { category: CategoryId; hits: number } | null = null;

  for (const category of CATEGORIES) {
    if (category.id === 'andet') continue;
    let hits = 0;
    for (const keyword of category.keywords) {
      if (haystack.includes(keyword)) hits += keyword.length > 5 ? 2 : 1;
    }
    if (hits > 0 && (!best || hits > best.hits)) best = { category: category.id, hits };
  }

  if (best && best.hits >= 2) {
    return { category: best.category, label: 'kategori gættet ud fra vareteksten' };
  }
  return { category: 'andet', label: 'kategori kunne ikke gættes' };
}

/**
 * Nogle gange læser OCR'en alle varenavne først og alle beløb bagefter
 * (to "spalter"). Her parres de i rækkefølge, så varelinjerne ikke går tabt.
 */
function pairSplitColumns(lines: string[]): ReceiptItem[] {
  const items: ReceiptItem[] = [];
  let pendingNames: string[] = [];

  const isAmountOnly = (line: string) => {
    if (hasLetters(line)) return false;
    const amounts = amountsInLine(line);
    return amounts.length === 1;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s{2,}/g, ' ').trim();
    const upper = line.toUpperCase();

    if (isAmountOnly(line)) {
      const amount = amountsInLine(line)[0];
      const name = pendingNames.shift();
      if (name && name.length >= 2 && amount > 0) {
        items.push({ name, amount });
      }
      continue;
    }

    if (hasLetters(line) && amountsInLine(line).length === 0 && line.length <= 42) {
      if (isGuarded(upper, NON_ITEM_PATTERNS)) {
        pendingNames = [];
        continue;
      }
      pendingNames.push(sentenceCase(line));
      continue;
    }

    pendingNames = [];
  }

  return items;
}

export function parseReceipt(rawText: string): ParsedReceipt {
  const text = normalizeText(rawText ?? '');
  const lines = toLines(text);
  const upperText = text.toUpperCase();
  const signals: string[] = [];

  if (lines.length === 0) {
    return { items: [], raw: rawText ?? '', confidence: 0, signals: ['ingen tekst fundet'] };
  }

  // 1) Total
  const totalMatch = findTotal(lines);
  let items = findItems(lines, totalMatch?.index ?? null);
  if (items.length < 2) {
    const paired = pairSplitColumns(lines);
    if (paired.length > items.length) items = paired;
  }

  let amount: number | undefined;
  let confidence = 0;

  if (totalMatch) {
    amount = totalMatch.amount;
    confidence += 0.55;
    signals.push(totalMatch.label);
  } else {
    // Fallback: summer varelinjerne, ellers tag det største beløb der ikke er en moms-linje.
    const itemSum = items.reduce((sum, item) => sum + item.amount, 0);
    if (items.length >= 2 && itemSum > 0) {
      amount = Math.round(itemSum * 100) / 100;
      confidence += 0.25;
      signals.push(`ingen totallinje — summerede ${items.length} varer`);
    } else {
      const allAmounts = lines
        .filter((line) => !isGuarded(line.toUpperCase(), GUARD_PATTERNS))
        .flatMap((line) => amountsInLine(line))
        .filter((value) => value > 0);
      if (allAmounts.length > 0) {
        amount = Math.max(...allAmounts);
        confidence += 0.1;
        signals.push('tog det største beløb på kvitteringen');
      }
    }
  }

  // 2) Moms-kontrol (25 % moms = 20 % af totalen)
  const moms = findMoms(lines);
  if (moms && amount && Math.abs(moms - amount * 0.2) < Math.max(1, amount * 0.01)) {
    confidence += 0.06;
    signals.push('momsen stemmer (25 %)');
  }

  // 3) Dato
  const dateResult = findDate(lines);
  if (dateResult) {
    confidence += 0.14;
    signals.push(dateResult.label);
  }

  // 4) Butik
  const merchantResult = findMerchant(lines, upperText);
  if (merchantResult.merchant) {
    confidence += merchantResult.brandCategory ? 0.16 : 0.07;
    if (merchantResult.label) signals.push(merchantResult.label);
  }

  // 5) Kategori
  const itemText = items.map((item) => item.name).join(' ');
  const { category, label } = guessCategory(`${merchantResult.merchant ?? ''} ${itemText} ${text.slice(0, 400)}`, merchantResult.brandCategory);
  signals.push(label);

  // 6) Varer
  if (items.length >= 2) {
    confidence += 0.08;
    signals.push(`læste ${items.length} varelinjer`);
  }

  return {
    merchant: merchantResult.merchant,
    amount,
    date: dateResult?.date,
    category,
    items,
    raw: rawText ?? '',
    confidence: Math.max(0, Math.min(0.98, confidence)),
    signals,
  };
}
