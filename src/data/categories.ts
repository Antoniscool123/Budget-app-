import type { Category, CategoryId } from '../types';

export const CATEGORIES: Category[] = [
  {
    id: 'dagligvarer',
    name: 'Dagligvarer',
    emoji: '🛒',
    color: '#14b8a6',
    keywords: [
      'netto', 'rema', 'føtex', 'fotex', 'bilka', 'lidl', 'aldi', 'irma', 'superbrugsen',
      'kvickly', 'brugsen', 'coop', '365discount', '365 discount', 'meny', 'spar', 'min købmand',
      'nærkøb', 'abc lavpris', 'løvbjerg', 'fakta', 'salling super', 'inco', 'letkøb', 'helsam',
      'dagligvarer', 'mælk', 'brød', 'æg', 'smør', 'ost', 'kaffe', 'banan', 'æble', 'kylling',
      'hakket', 'pasta', 'ris', 'yoghurt', 'fløde', 'sukker', 'mel', 'øl', 'vin', 'chips',
      'rema1000', '7-eleven', '7 eleven', 'kiosk', 'grocery',
    ],
  },
  {
    id: 'restaurant',
    name: 'Restaurant & café',
    emoji: '🍔',
    color: '#f59e0b',
    keywords: [
      'mcdonald', 'burger king', 'sunset boulevard', 'joe & the juice', 'starbucks', 'café',
      'cafe', 'restaurant', 'pizzeria', 'pizza', 'domino', 'just eat', 'justeat', 'wolt', 'kfc',
      'subway', 'baresso', 'espresso house', 'bone', 'jensens', 'sushi', 'grill', 'bar', 'brasserie',
      'bager', 'isbar', 'gelato', 'foodora', 'takeaway',
    ],
  },
  {
    id: 'transport',
    name: 'Transport',
    emoji: '🚗',
    color: '#3b82f6',
    keywords: [
      'shell', 'circle k', 'q8', 'uno-x', 'f24', 'ingo', 'oil', 'benzin', 'diesel', 'dansk benzin',
      'dsb', 'rejsekort', 'metro', 'movia', 'arriva', 'parkering', 'q-park', 'easypark', 'uber',
      'bolt', 'taxa', 'taxi', 'billet', 'tog', 'bus', 'broafgift', 'storebælt', 'øresund',
    ],
  },
  {
    id: 'bolig',
    name: 'Bolig & faste udgifter',
    emoji: '🏠',
    color: '#8b5cf6',
    keywords: [
      'husleje', 'leje', 'bolig', 'andelsbolig', 'ejendom', 'el', 'varme', 'vand', 'fjernvarme',
      'norlys', 'andels', 'ørsted', 'orsted', 'tdc', 'yousee', 'telia', 'telmore', 'cbb', 'oister',
      'fiber', 'regning', 'forsikring', 'indbo', 'husejer',
    ],
  },
  {
    id: 'shopping',
    name: 'Shopping',
    emoji: '🛍️',
    color: '#ec4899',
    keywords: [
      'elgiganten', 'power', 'jysk', 'ikea', 'harald nyborg', 'silvan', 'bauhaus', 'normal',
      'h&m', 'h og m', 'zara', 'zalando', 'sport24', 'sportmaster', 'stadium', 'biltema',
      'thansen', 'thansen', 'føtex plus', 'matas', 'salling', 'magasin', 'ilva', 'jysk',
      'tøj', 'sko', 'møbel', 'legetøj', 'br',
    ],
  },
  {
    id: 'fritid',
    name: 'Fritid & abonnementer',
    emoji: '🎬',
    color: '#6366f1',
    keywords: [
      'fitness', 'sats', 'loop', 'biograf', 'cinema', 'nordisk film', 'steam', 'spotify', 'netflix',
      'hbo', 'disney', 'storytel', 'mofibo', 'museum', 'zoo', 'tivoli', 'svømmehal', 'klub',
      'forening', 'abonnement', 'playstation', 'xbox', 'nintendo', 'bowling', 'golf',
    ],
  },
  {
    id: 'sundhed',
    name: 'Sundhed & pleje',
    emoji: '💊',
    color: '#10b981',
    keywords: [
      'apotek', 'læge', 'laege', 'tandlæge', 'sygehus', 'medicin', 'optiker', 'fysioterapi',
      'psykolog', 'kiropraktor', 'frisør', 'barber', 'pleje', 'vitamin', 'kosttilskud',
    ],
  },
  {
    id: 'rejser',
    name: 'Rejser',
    emoji: '✈️',
    color: '#0ea5e9',
    keywords: [
      'hotel', 'fly', 'sas', 'norwegian', 'ryanair', 'easyjet', 'airbnb', 'booking', 'expedia',
      'ferie', 'camping', 'lufthavn', 'kastrup', 'rejse', 'togbillet', 'dsb rejse',
    ],
  },
  {
    id: 'born',
    name: 'Børn',
    emoji: '🧸',
    color: '#f97316',
    keywords: [
      'børnehave', 'vuggestue', 'sfo', 'fritidshjem', 'legetøj', 'babysam', 'kids', 'junior',
      'børn', 'bleer', 'pampers', 'legoland', 'fårup', 'bonbonland',
    ],
  },
  {
    id: 'andet',
    name: 'Andet',
    emoji: '📦',
    color: '#94a3b8',
    keywords: [],
  },
];

export const CATEGORY_MAP: Record<CategoryId, Category> = CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.id]: c }),
  {} as Record<CategoryId, Category>,
);

export function getCategory(id: CategoryId | undefined): Category {
  return (id && CATEGORY_MAP[id]) || CATEGORY_MAP.andet;
}
