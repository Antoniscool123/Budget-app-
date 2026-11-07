import { describe, expect, it } from 'vitest';
import { parseReceipt } from './receiptParser';
import { parseAmountString } from './format';

const NETTO_RECEIPT = `
NETTO
Vesterbrogade 12
1620 København V
CVR 12345678
DATO 04-11-2026  KL. 17:42
KASSE 3  MEDARBEJDER 1234

ØKOLOGISK LETMÆLK 1L        14,95
RUGBRØD                    22,50
ÆG 10 STK                  32,95
HAKKET OKSEKØD 400G        39,95
BANANER                     8,95
KAFFE 500G                 45,95
-i alt                    165,25
MOMS 25% AF 41,31          41,31
I ALT DKK                 165,25
DANKORT                   165,25
TAK FOR HANDLEN
`;

const FOTEX_RECEIPT = `
føtex
Søndergade 3, Aarhus
Tlf. 89 12 34 56
Dato: 01.11.2026
Kl. 12:03

Fuldkornspasta 500g        12,95
Laks 250 g                 89,00
Rød peber                  9,95
Hummus                     24,95
Økologisk yoghurt 1 l      19,95
I ALT                     156,80
MOMSBELØB                  31,36
KONTANT                   200,00
BYTTE                      43,20
`;

const APOTEK_RECEIPT = `
APOTEKET
Nørrebrogade 44
01-11-2026

Vitamin D3               149,95
Plaster                   34,50
AT BETALE                184,45
MOMS                       36,89
`;

describe('parseAmountString', () => {
  it('forstår danske tusindtal og decimaler', () => {
    expect(parseAmountString('1.234,56')).toBe(1234.56);
    expect(parseAmountString('1 234,56')).toBe(1234.56);
    expect(parseAmountString('12,95')).toBe(12.95);
    expect(parseAmountString('1234.56')).toBe(1234.56);
    expect(parseAmountString('185')).toBe(185);
    expect(parseAmountString('')).toBeNull();
  });
});

describe('parseReceipt', () => {
  it('læser total, dato, butik og varer fra en Netto-bon', () => {
    const result = parseReceipt(NETTO_RECEIPT);
    expect(result.amount).toBe(165.25);
    expect(result.merchant).toBe('Netto');
    expect(result.date).toBe('2026-11-04');
    expect(result.category).toBe('dagligvarer');
    expect(result.items.length).toBeGreaterThanOrEqual(5);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('ignorerer rabat-, moms- og byttelinjer og vælger den rigtige total', () => {
    const result = parseReceipt(FOTEX_RECEIPT);
    expect(result.amount).toBe(156.8);
    expect(result.merchant).toBe('føtex');
    expect(result.date).toBe('2026-11-01');
    expect(result.items.some((item) => /rabat|moms|kontant|bytte/i.test(item.name))).toBe(false);
  });

  it('bruger "at betale" og gætter kategori ud fra butikken', () => {
    const result = parseReceipt(APOTEK_RECEIPT);
    expect(result.amount).toBe(184.45);
    expect(result.merchant).toBe('Apotek');
    expect(result.category).toBe('sundhed');
  });

  it('findes beløbet på linjen under nøgleordet', () => {
    const result = parseReceipt(`
REMA 1000
DATO 03-11-2026
ÆBLER       19,95
MÆLK        12,50
I ALT
            32,45
`);
    expect(result.amount).toBe(32.45);
    expect(result.merchant).toBe('REMA 1000');
  });

  it('falder tilbage til summen af varer, når der ikke er en totallinje', () => {
    const result = parseReceipt(`
Min Købmand
02.11.2026
Brød        20,00
Ost         30,00
`);
    expect(result.amount).toBe(50);
    expect(result.signals.join(' ')).toContain('summerede');
  });

  it('læser tusindtal og dato med månedsnavn', () => {
    const result = parseReceipt(`
ELGIGANTEN
5. NOV 2026
USB-C KABEL               1.234,56
I ALT DKK                 1.234,56
`);
    expect(result.amount).toBe(1234.56);
    expect(result.date).toBe('2026-11-05');
    expect(result.category).toBe('shopping');
  });

  it('håndterer engelsk kvittering', () => {
    const result = parseReceipt(`
STARBUCKS
01/11/2026
Flat White        45.00
TOTAL             45.00
`);
    expect(result.amount).toBe(45);
    expect(result.merchant).toBe('Starbucks');
    expect(result.category).toBe('restaurant');
  });

  it('giver 0 i sikkerhed ved tom tekst', () => {
    const result = parseReceipt('');
    expect(result.confidence).toBe(0);
    expect(result.amount).toBeUndefined();
  });

  it('tolker ikke en dato som beløb', () => {
    const result = parseReceipt(`
NETTO
04-11-2026
Kaffe   45,95
I ALT   45,95
`);
    expect(result.amount).toBe(45.95);
  });
});
