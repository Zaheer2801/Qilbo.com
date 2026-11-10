// Category and Brand Classification Engine for Discount Liquor
// Standard 7 Groups: Spirits, Beer & RTD, Wine, Drinks & Mixers, Snacks & Grocery, Tobacco, Lottery

export const GROUPS = [
  'Spirits',
  'Beer & RTD',
  'Wine',
  'Drinks & Mixers',
  'Snacks & Grocery',
  'Tobacco',
  'Lottery'
];

export const SUB_CATEGORIES = {
  'Spirits': ['Vodka', 'Tequila/Mezcal', 'Whiskey', 'Cognac/Brandy', 'Rum', 'Gin', 'Liqueur', 'Other Spirits – review'],
  'Beer & RTD': ['Beer', 'RTD/Seltzer'],
  'Wine': ['Wine'],
  'Drinks & Mixers': ['Drinks & Mixers'],
  'Snacks & Grocery': ['Snacks & Grocery'],
  'Tobacco': ['Cigarettes', 'Cigars/Cigarillos', 'Vapes', 'Accessories'],
  'Lottery': ['Lottery']
};

export function levenshtein(s1, s2) {
  if (Math.abs(s1.length - s2.length) > 2) return 99;
  if (s1 === s2) return 0;
  const d = Array.from({ length: s1.length + 1 }, (_, i) => [i, ...Array(s2.length).fill(0)]);
  for (let j = 1; j <= s2.length; j++) d[0][j] = j;
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[s1.length][s2.length];
}

export function normStr(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Canonical Brand Catalog with POS Typo Aliases
export const CANONICAL_BRANDS = [
  // Spirits - Whiskey
  { brand: "Jack Daniel's", group: "Spirits", sub: "Whiskey", keys: ["jack daniel", "jack daniels", "jackdaniel", "jackdaniels", "gentleman jack"] },
  { brand: "Jim Beam", group: "Spirits", sub: "Whiskey", keys: ["jim beam", "jimbeam", "jim bean", "jimbean peach"] },
  { brand: "Crown Royal", group: "Spirits", sub: "Whiskey", keys: ["crown royal", "crow royal", "crown royale"] },
  { brand: "Fireball", group: "Spirits", sub: "Whiskey", keys: ["fireball"] },
  { brand: "Jameson", group: "Spirits", sub: "Whiskey", keys: ["jameson"] },
  { brand: "Maker's Mark", group: "Spirits", sub: "Whiskey", keys: ["maker's mark", "makers mark", "maker's 46", "makers 46"] },
  { brand: "Woodford", group: "Spirits", sub: "Whiskey", keys: ["woodford", "woodford reserve"] },
  { brand: "Johnnie Walker", group: "Spirits", sub: "Whiskey", keys: ["johnnie walker", "johnny walker", "black label", "red label"] },
  { brand: "Proper Twelve", group: "Spirits", sub: "Whiskey", keys: ["proper twelve", "proper no. twelve", "proper no twelve", "proper 12", "proper12"] },
  { brand: "Canadian Mist", group: "Spirits", sub: "Whiskey", keys: ["canadian mist", "canadianmist"] },
  { brand: "Knob Creek", group: "Spirits", sub: "Whiskey", keys: ["knob creek", "knobcreek"] },
  { brand: "Tullamore Dew", group: "Spirits", sub: "Whiskey", keys: ["tullamore dew", "tullamore"] },
  { brand: "Famous Grouse", group: "Spirits", sub: "Whiskey", keys: ["famous grouse", "the famous grouse"] },
  { brand: "Lauder's", group: "Spirits", sub: "Whiskey", keys: ["lauders", "laudersscotcg", "lauder scotch"] },
  { brand: "Wild Turkey", group: "Spirits", sub: "Whiskey", keys: ["wild turkey", "russell's reserve"] },
  { brand: "Evan Williams", group: "Spirits", sub: "Whiskey", keys: ["evan williams"] },
  { brand: "Bulleit", group: "Spirits", sub: "Whiskey", keys: ["bulleit"] },
  { brand: "Blanton's", group: "Spirits", sub: "Whiskey", keys: ["blantons", "blanton's", "blanton"] },
  { brand: "Eagle Rare", group: "Spirits", sub: "Whiskey", keys: ["eagle rare", "eaglerare"] },
  { brand: "Vat 69", group: "Spirits", sub: "Whiskey", keys: ["vat 69", "vat69"] },
  { brand: "Ole Smoky", group: "Spirits", sub: "Whiskey", keys: ["ole smoky", "ole smooky", "moonshine"] },
  { brand: "Seagram's 7", group: "Spirits", sub: "Whiskey", keys: ["seagram's 7", "seagrams 7", "seagram 7", "7 crown"] },
  { brand: "Southern Comfort", group: "Spirits", sub: "Whiskey", keys: ["southern comfort", "so co"] },
  { brand: "Canadian Club", group: "Spirits", sub: "Whiskey", keys: ["canadian club"] },
  { brand: "Black Velvet", group: "Spirits", sub: "Whiskey", keys: ["black velvet"] },
  { brand: "Rich & Rare", group: "Spirits", sub: "Whiskey", keys: ["rich & rare", "rich and rare"] },
  { brand: "Macallan", group: "Spirits", sub: "Whiskey", keys: ["macallan"] },
  { brand: "Glenfiddich", group: "Spirits", sub: "Whiskey", keys: ["glenfiddich"] },
  { brand: "Glenlivet", group: "Spirits", sub: "Whiskey", keys: ["glenlivet"] },
  { brand: "Dewar's", group: "Spirits", sub: "Whiskey", keys: ["dewar's", "dewars"] },
  { brand: "Buchanan's", group: "Spirits", sub: "Whiskey", keys: ["buchanan's", "buchanans"] },
  { brand: "Chivas Regal", group: "Spirits", sub: "Whiskey", keys: ["chivas", "chivas regal"] },

  // Spirits - Vodka
  { brand: "Tito's", group: "Spirits", sub: "Vodka", keys: ["tito's", "titos", "tito"] },
  { brand: "New Amsterdam", group: "Spirits", sub: "Vodka", keys: ["new amsterdam", "newamsterdam", "newamstersam", "amsterdam vodka"] },
  { brand: "Pink Whitney", group: "Spirits", sub: "Vodka", keys: ["pink whitney", "pinkwhitney"] },
  { brand: "Smirnoff", group: "Spirits", sub: "Vodka", keys: ["smirnoff", "smirnoff vodka"] },
  { brand: "Ciroc", group: "Spirits", sub: "Vodka", keys: ["ciroc"] },
  { brand: "Grey Goose", group: "Spirits", sub: "Vodka", keys: ["grey goose", "gray goose"] },
  { brand: "Absolut", group: "Spirits", sub: "Vodka", keys: ["absolut"] },
  { brand: "Ketel One", group: "Spirits", sub: "Vodka", keys: ["ketel one", "ketel"] },
  { brand: "Deep Eddy", group: "Spirits", sub: "Vodka", keys: ["deep eddy"] },
  { brand: "Western Son", group: "Spirits", sub: "Vodka", keys: ["western son", "westernson"] },
  { brand: "Exclusiv", group: "Spirits", sub: "Vodka", keys: ["exclusiv vdk", "exclusiv", "exclusive coconut"] },
  { brand: "Svedka", group: "Spirits", sub: "Vodka", keys: ["svedka"] },
  { brand: "Crystal Palace", group: "Spirits", sub: "Vodka", keys: ["crystal palace"] },
  { brand: "Platinum 7X", group: "Spirits", sub: "Vodka", keys: ["platinum 7x", "platimun 7x", "platinum"] },
  { brand: "Belvedere", group: "Spirits", sub: "Vodka", keys: ["belvedere"] },
  { brand: "Taaka", group: "Spirits", sub: "Vodka", keys: ["taaka"] },
  { brand: "Popov", group: "Spirits", sub: "Vodka", keys: ["popov"] },
  { brand: "Burnett's", group: "Spirits", sub: "Vodka", keys: ["burnett's", "burnetts"] },
  { brand: "Pinnacle", group: "Spirits", sub: "Vodka", keys: ["pinnacle"] },
  { brand: "Skol", group: "Spirits", sub: "Vodka", keys: ["skol"] },
  { brand: "Skyy", group: "Spirits", sub: "Vodka", keys: ["skyy"] },

  // Spirits - Tequila/Mezcal
  { brand: "Don Julio", group: "Spirits", sub: "Tequila/Mezcal", keys: ["don julio", "donjulio", "reposado", "blanco", "anejo", "añejo", "1942"] },
  { brand: "Patron", group: "Spirits", sub: "Tequila/Mezcal", keys: ["patron", "patrón"] },
  { brand: "Casamigos", group: "Spirits", sub: "Tequila/Mezcal", keys: ["casamigos"] },
  { brand: "Jose Cuervo", group: "Spirits", sub: "Tequila/Mezcal", keys: ["jose cuervo", "cuervo", "cuervo especial", "tradicional", "juse margaritas"] },
  { brand: "1800", group: "Spirits", sub: "Tequila/Mezcal", keys: ["1800 tequila", "1800 reposado", "1800 silver", "1800 anejo", "1800 cristalino"] },
  { brand: "El Jimador", group: "Spirits", sub: "Tequila/Mezcal", keys: ["el jimador", "eljimador", "jimador"] },
  { brand: "Gran Coramino", group: "Spirits", sub: "Tequila/Mezcal", keys: ["gran coramino", "coramino"] },
  { brand: "Centenario", group: "Spirits", sub: "Tequila/Mezcal", keys: ["centanario", "centenario"] },
  { brand: "Corralejo", group: "Spirits", sub: "Tequila/Mezcal", keys: ["corralejo"] },
  { brand: "Herradura", group: "Spirits", sub: "Tequila/Mezcal", keys: ["herradura"] },
  { brand: "Lunazul", group: "Spirits", sub: "Tequila/Mezcal", keys: ["lunazul"] },
  { brand: "El Mayor", group: "Spirits", sub: "Tequila/Mezcal", keys: ["el mayor"] },
  { brand: "Margaritaville", group: "Spirits", sub: "Tequila/Mezcal", keys: ["margaritaville tequila", "margaritaville gold", "margaritaville silver"] },
  { brand: "Teremana", group: "Spirits", sub: "Tequila/Mezcal", keys: ["teremana"] },
  { brand: "Espolon", group: "Spirits", sub: "Tequila/Mezcal", keys: ["espolon", "espolón"] },
  { brand: "Hornitos", group: "Spirits", sub: "Tequila/Mezcal", keys: ["hornitos", "sauza hornitos"] },
  { brand: "Cazadores", group: "Spirits", sub: "Tequila/Mezcal", keys: ["cazadores"] },
  { brand: "Milagro", group: "Spirits", sub: "Tequila/Mezcal", keys: ["milagro"] },
  { brand: "Clase Azul", group: "Spirits", sub: "Tequila/Mezcal", keys: ["clase azul"] },
  { brand: "La Catrina", group: "Spirits", sub: "Tequila/Mezcal", keys: ["la catrina"] },

  // Spirits - Cognac/Brandy
  { brand: "Hennessy", group: "Spirits", sub: "Cognac/Brandy", keys: ["hennessy", "hennesy", "hennessy vs", "hennesy vs", "hennessy vsop", "hennessy black", "hennessy pure white"] },
  { brand: "Remy Martin", group: "Spirits", sub: "Cognac/Brandy", keys: ["remy martin", "remy", "1738"] },
  { brand: "Paul Masson", group: "Spirits", sub: "Cognac/Brandy", keys: ["paul masson", "paul massion", "paum massion", "paum masson", "paul masson peach", "paul masson apple"] },
  { brand: "E&J", group: "Spirits", sub: "Cognac/Brandy", keys: ["e&j", "e & j", "e and j", "ej brandy", "ej"] },
  { brand: "Courvoisier", group: "Spirits", sub: "Cognac/Brandy", keys: ["courvoisier"] },
  { brand: "Martell", group: "Spirits", sub: "Cognac/Brandy", keys: ["martell"] },
  { brand: "D'USSE", group: "Spirits", sub: "Cognac/Brandy", keys: ["d'usse", "dusse"] },
  { brand: "Christian Brothers", group: "Spirits", sub: "Cognac/Brandy", keys: ["christian brothers", "christian bro"] },

  // Spirits - Rum
  { brand: "Bacardi", group: "Spirits", sub: "Rum", keys: ["bacardi", "dragonberry"] },
  { brand: "Captain Morgan", group: "Spirits", sub: "Rum", keys: ["captain morgan", "capt morgan"] },
  { brand: "Malibu", group: "Spirits", sub: "Rum", keys: ["malibu"] },
  { brand: "Don Q", group: "Spirits", sub: "Rum", keys: ["don q", "don q cristal", "donq"] },
  { brand: "Barbancourt", group: "Spirits", sub: "Rum", keys: ["barbancourt", "rhum barbacourt", "barbacourt"] },
  { brand: "Calypso", group: "Spirits", sub: "Rum", keys: ["calypso", "calypso rum", "calypso spiced"] },
  { brand: "Sailor Jerry", group: "Spirits", sub: "Rum", keys: ["sailor jerry", "sailor jrrry", "sailor jerry spiced"] },
  { brand: "Kraken", group: "Spirits", sub: "Rum", keys: ["kraken", "the kraken"] },
  { brand: "Bumbu", group: "Spirits", sub: "Rum", keys: ["bumbu"] },
  { brand: "Appleton", group: "Spirits", sub: "Rum", keys: ["appleton"] },
  { brand: "Cruzan", group: "Spirits", sub: "Rum", keys: ["cruzan"] },

  // Spirits - Gin
  { brand: "Tanqueray", group: "Spirits", sub: "Gin", keys: ["tanqueray"] },
  { brand: "Bombay", group: "Spirits", sub: "Gin", keys: ["bombay", "bombay sapphire"] },
  { brand: "Beefeater", group: "Spirits", sub: "Gin", keys: ["beefeater"] },
  { brand: "Hendrick's", group: "Spirits", sub: "Gin", keys: ["hendrick's", "hendricks"] },
  { brand: "Seagram's Gin", group: "Spirits", sub: "Gin", keys: ["seagram's gin", "seagrams gin", "seagram gin"] },
  { brand: "Gordon's", group: "Spirits", sub: "Gin", keys: ["gordon's", "gordons"] },

  // Spirits - Liqueur
  { brand: "99 Brand", group: "Spirits", sub: "Liqueur", keys: ["99 brand", "99 bananas", "99 pink", "99 sour", "99 proof", "99 root", "99 apples", "99 peaches", "99 blackberries", "99 cherries", "99 grapes", "99 watermelons", "99 butterscotch", "99 whipped", "99 pineapple", "99 strawberry", "99 orange", "99 mango", "99shot", "99 shot", "99party", "99 party"] },
  { brand: "Benjamin Banana", group: "Spirits", sub: "Liqueur", keys: ["benjamin banana", "benjaminbanana", "benjamine 100", "benjamins grape"] },
  { brand: "Mr. Boston", group: "Spirits", sub: "Liqueur", keys: ["mr boston", "mr. boston", "mr.boston", "mr boston blue"] },
  { brand: "Gran Gala", group: "Spirits", sub: "Liqueur", keys: ["gran gala", "grangala"] },
  { brand: "Whipshots", group: "Spirits", sub: "Liqueur", keys: ["whip shots", "whipshots"] },
  { brand: "Boba Pops", group: "Spirits", sub: "Liqueur", keys: ["boba pops", "bobapops"] },
  { brand: "Chi-Chi's", group: "Spirits", sub: "Liqueur", keys: ["chi chi", "chi chi's", "chichi"] },
  { brand: "Baileys", group: "Spirits", sub: "Liqueur", keys: ["baileys", "bailey's"] },
  { brand: "Kahlua", group: "Spirits", sub: "Liqueur", keys: ["kahlua"] },
  { brand: "Jagermeister", group: "Spirits", sub: "Liqueur", keys: ["jagermeister", "jager", "jägermeister"] },
  { brand: "Grand Marnier", group: "Spirits", sub: "Liqueur", keys: ["grand marnier"] },
  { brand: "Cointreau", group: "Spirits", sub: "Liqueur", keys: ["cointreau"] },
  { brand: "Disaronno", group: "Spirits", sub: "Liqueur", keys: ["disaronno", "amaretto disaronno"] },
  { brand: "DeKuyper", group: "Spirits", sub: "Liqueur", keys: ["dekuyper", "peachtree"] },
  { brand: "Hpnotiq", group: "Spirits", sub: "Liqueur", keys: ["hpnotiq", "hypnotiq"] },
  { brand: "RumChata", group: "Spirits", sub: "Liqueur", keys: ["rumchata"] },

  // Beer & RTD - RTD/Seltzer
  { brand: "Clubtails", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["clubtails", "club tail", "clubtail", "club tails"] },
  { brand: "BuzzBallz", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["buzzballz", "buzz ball", "buzzball", "buzz balls"] },
  { brand: "Big Sipz", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["big sipz", "bigsipz", "big sip"] },
  { brand: "Cutwater", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["cutwater", "cut water"] },
  { brand: "High Noon", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["high noon", "highnoon"] },
  { brand: "White Claw", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["white claw", "whiteclaw", "whit claw", "whit clawvaritypack"] },
  { brand: "Carbliss", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["carbliss"] },
  { brand: "Surfside", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["surfside"] },
  { brand: "Onda", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["onda"] },
  { brand: "Twisted Shotz", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["twisted shotz", "twistedshotz"] },
  { brand: "Truly", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["truly"] },
  { brand: "Cayman Jack", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["cayman jack", "cayman"] },
  { brand: "Monaco", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["monaco"] },
  { brand: "BeatBox", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["beatbox", "beat box"] },
  { brand: "Twisted Tea", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["twisted tea"] },
  { brand: "Mike's", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["mike's hard", "mikes hard", "mike's", "mikes lemonade"] },
  { brand: "Smirnoff Ice", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["smirnoff ice"] },
  { brand: "Seagram's Escapes", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["seagram's escapes", "seagram escapes", "seagrams escapes"] },
  { brand: "Four Loko", group: "Beer & RTD", sub: "RTD/Seltzer", keys: ["four loko", "fourloko"] },

  // Beer & RTD - Beer
  { brand: "Michelob", group: "Beer & RTD", sub: "Beer", keys: ["michelob", "michelob ultra", "micgelab", "micgelab ultra", "michelo", "ultra"] },
  { brand: "Corona", group: "Beer & RTD", sub: "Beer", keys: ["corona", "corona extra", "corona premier", "coronita", "coronita extra"] },
  { brand: "Modelo", group: "Beer & RTD", sub: "Beer", keys: ["modelo", "modelo especial", "modelo negra", "modelito"] },
  { brand: "Bud Light", group: "Beer & RTD", sub: "Beer", keys: ["bud light", "budlight"] },
  { brand: "Budweiser", group: "Beer & RTD", sub: "Beer", keys: ["budweiser", "bud "] },
  { brand: "Busch", group: "Beer & RTD", sub: "Beer", keys: ["busch", "busch light"] },
  { brand: "Natural Ice", group: "Beer & RTD", sub: "Beer", keys: ["natural ice", "natty ice", "natty daddy", "natural light"] },
  { brand: "Heineken", group: "Beer & RTD", sub: "Beer", keys: ["heineken", "heineken 0.0", "heineken silver"] },
  { brand: "Stella Artois", group: "Beer & RTD", sub: "Beer", keys: ["stella artois", "stella"] },
  { brand: "Miller", group: "Beer & RTD", sub: "Beer", keys: ["miller lite", "miller high life", "miller genuine draft"] },
  { brand: "Coors", group: "Beer & RTD", sub: "Beer", keys: ["coors light", "coors banquet", "coors"] },
  { brand: "Colt 45", group: "Beer & RTD", sub: "Beer", keys: ["colt 45", "colt45"] },
  { brand: "Rolling Rock", group: "Beer & RTD", sub: "Beer", keys: ["rolling rock"] },
  { brand: "Steel Reserve", group: "Beer & RTD", sub: "Beer", keys: ["steel reserve", "211"] },
  { brand: "Tecate", group: "Beer & RTD", sub: "Beer", keys: ["tecate"] },
  { brand: "Dogfish Head", group: "Beer & RTD", sub: "Beer", keys: ["dogfish head", "dogfish"] },
  { brand: "Flying Buddha", group: "Beer & RTD", sub: "Beer", keys: ["flying budha", "flying buddha"] },
  { brand: "Guinness", group: "Beer & RTD", sub: "Beer", keys: ["guinness"] },
  { brand: "Yuengling", group: "Beer & RTD", sub: "Beer", keys: ["yuengling"] },

  // Wine
  { brand: "19 Crimes", group: "Wine", sub: "Wine", keys: ["19 crimes", "19 crimes dark red"] },
  { brand: "Menage a Trois", group: "Wine", sub: "Wine", keys: ["menage a'trois", "menage a trois", "manega"] },
  { brand: "Riunite", group: "Wine", sub: "Wine", keys: ["riunite", "riunite lambursco"] },
  { brand: "MD 20/20", group: "Wine", sub: "Wine", keys: ["md 20/20", "md 2020", "md 20 20", "mad dog 20/20", "md tangy orange", "md island pineapple"] },
  { brand: "Taylor", group: "Wine", sub: "Wine", keys: ["taylor port", "taylor", "taylor new york"] },
  { brand: "Sutter Home", group: "Wine", sub: "Wine", keys: ["sutter home"] },
  { brand: "Barefoot", group: "Wine", sub: "Wine", keys: ["barefoot", "barefoot bubbly"] },
  { brand: "Carlo Rossi", group: "Wine", sub: "Wine", keys: ["carlo rossi"] },
  { brand: "Franzia", group: "Wine", sub: "Wine", keys: ["franzia"] },
  { brand: "Stella Rosa", group: "Wine", sub: "Wine", keys: ["stella rosa"] },
  { brand: "Yellow Tail", group: "Wine", sub: "Wine", keys: ["yellow tail"] },
  { brand: "Woodbridge", group: "Wine", sub: "Wine", keys: ["woodbridge"] },
  { brand: "Wild Irish Rose", group: "Wine", sub: "Wine", keys: ["wild irish rose"] },
  { brand: "Belaire", group: "Wine", sub: "Wine", keys: ["belaire", "luc belaire"] },
  { brand: "Moet & Chandon", group: "Wine", sub: "Wine", keys: ["moet", "moët", "dom perignon", "veuve clicquot"] },

  // Drinks & Mixers
  { brand: "Sunkist", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["sunkist"] },
  { brand: "RC Cola", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["rc cola", "rc cola 2l"] },
  { brand: "Starbucks", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["starbucks", "frappuccino"] },
  { brand: "Bluebird", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["bluebird", "bluebird juice"] },
  { brand: "Premier Protein", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["premier protein"] },
  { brand: "Core Power", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["core power"] },
  { brand: "Tropicana", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["tropicana", "tropicana cran", "tropicana pine"] },
  { brand: "Dole", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["dole", "dole orange"] },
  { brand: "Zephyrhills", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["zephyrhills"] },
  { brand: "Topo Chico", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["topo chico"] },
  { brand: "Jarritos", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["jarritos"] },
  { brand: "Minute Maid", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["minute maid"] },
  { brand: "VitaminWater", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["vitaminwater", "vitamin water"] },
  { brand: "Coca-Cola", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["coca-cola", "coca cola", "coke", "diet coke", "coke zero"] },
  { brand: "Pepsi", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["pepsi", "diet pepsi"] },
  { brand: "Sprite", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["sprite", "sprite zero"] },
  { brand: "Mountain Dew", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["mountain dew", "mt dew"] },
  { brand: "Dr Pepper", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["dr pepper", "dr. pepper", "mr pibb"] },
  { brand: "Fanta", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["fanta"] },
  { brand: "7UP", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["7 up", "7up", "seven up"] },
  { brand: "A&W", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["a & w", "a&w", "root beer"] },
  { brand: "Canada Dry", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["canada dry", "ginger ale"] },
  { brand: "Red Bull", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["red bull", "redbull"] },
  { brand: "Monster", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["monster energy", "monster", "beast peach"] },
  { brand: "Celsius", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["celsius"] },
  { brand: "C4", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["c4 16oz", "c4 energy"] },
  { brand: "NOS", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["nos high perfomance", "nos energy"] },
  { brand: "Gatorade", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["gatorade", "g zeroo"] },
  { brand: "Powerade", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["powerade"] },
  { brand: "Life Wtr", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["life wtr", "lifewtr"] },
  { brand: "BodyArmor", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["bodyarmor", "body armor"] },
  { brand: "Arizona", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["arizona tea", "arizona"] },
  { brand: "Zing Zang", group: "Drinks & Mixers", sub: "Drinks & Mixers", keys: ["zing zang", "bloody mary mix", "margarita mix", "mr and mrs t"] },

  // Snacks & Grocery
  { brand: "Deconna", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["deconna", "decana", "ice cream bar", "sandwich 6oz"] },
  { brand: "Lay's", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["lay's", "lays"] },
  { brand: "Doritos", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["doritos"] },
  { brand: "Cheetos", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["cheetos"] },
  { brand: "Pringles", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["pringles"] },
  { brand: "Zapp's", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["zapp's", "zapps", "voodoo"] },
  { brand: "Moon Pie", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["moon pie", "moonpie"] },
  { brand: "Nestle", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["nestle", "nestle crunch"] },
  { brand: "Tic Tac", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["tic tac"] },
  { brand: "Cloverhill", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["cloverhill bakery", "cloverhill"] },
  { brand: "Crystal", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["crystal louisiana", "hot sauce"] },
  { brand: "Margaret Holmes", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["peanut patch", "margaret holmes"] },
  { brand: "Costar", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["costar", "white shrip", "white shrimp"] },
  { brand: "Tyson", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["tyson garlic wings", "tyson"] },
  { brand: "Buldak", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["buldak", "buldak ramen", "ramen"] },
  { brand: "Nissin", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["nissin", "bowl noodles", "cup noodles"] },
  { brand: "Nescafe", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["nescafe"] },
  { brand: "Mahatma", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["mahatma"] },
  { brand: "Grace", group: "Snacks & Grocery", sub: "Snacks & Grocery", keys: ["grace:cock", "grace curry powder", "grace:browning"] },

  // Tobacco
  { brand: "Marlboro", group: "Tobacco", sub: "Cigarettes", keys: ["marlboro"] },
  { brand: "Newport", group: "Tobacco", sub: "Cigarettes", keys: ["newport"] },
  { brand: "305", group: "Tobacco", sub: "Cigarettes", keys: ["305's", "305 "] },
  { brand: "Camel", group: "Tobacco", sub: "Cigarettes", keys: ["camel"] },
  { brand: "Seneca", group: "Tobacco", sub: "Cigarettes", keys: ["seneca"] },
  { brand: "Native", group: "Tobacco", sub: "Cigarettes", keys: ["native green", "native 100s", "native light blue"] },
  { brand: "Lucky Strike", group: "Tobacco", sub: "Cigarettes", keys: ["lucky strike"] },
  { brand: "American Spirit", group: "Tobacco", sub: "Cigarettes", keys: ["american spirit"] },
  { brand: "Backwoods", group: "Tobacco", sub: "Cigars/Cigarillos", keys: ["backwood", "backwoods"] },
  { brand: "Black & Mild", group: "Tobacco", sub: "Cigars/Cigarillos", keys: ["black & mild", "black and mild"] },
  { brand: "Swisher", group: "Tobacco", sub: "Cigars/Cigarillos", keys: ["swisher", "swisher sweets"] },
  { brand: "Dutch Masters", group: "Tobacco", sub: "Cigars/Cigarillos", keys: ["dutch master", "dutch masters", "dutch "] },
  { brand: "Game", group: "Tobacco", sub: "Cigars/Cigarillos", keys: ["game cigar", "game leaf"] },
  { brand: "White Owl", group: "Tobacco", sub: "Cigars/Cigarillos", keys: ["white owl"] },
  { brand: "Bob Marley", group: "Tobacco", sub: "Accessories", keys: ["bob marley pure hamp", "bob marley"] },
  { brand: "RAW", group: "Tobacco", sub: "Accessories", keys: ["raw paper", "raw ", "rolling paper"] },
  { brand: "Bic", group: "Tobacco", sub: "Accessories", keys: ["bic lighter", "bic disposable", "bic "] },
  { brand: "Cake", group: "Tobacco", sub: "Vapes", keys: ["cake 2.0", "cake resin"] },
  { brand: "Lost THC", group: "Tobacco", sub: "Vapes", keys: ["lost thc", "lost thc sativa"] }
];

// Pre-build normalized lookup map
const NORMALIZED_LOOKUP = new Map();
for (const item of CANONICAL_BRANDS) {
  for (const k of item.keys) {
    const norm = normStr(k);
    if (norm) {
      NORMALIZED_LOOKUP.set(norm, item);
    }
  }
}

/**
 * Classify product using typo-tolerant matching against canonical brand list
 * followed by keyword rules and department clues.
 */
export function classifyProductFull({ name, cleanName = '', department = '', brand = '', unitPrice = 0 }) {
  const rawText = `${name || ''} ${cleanName || ''} ${brand || ''}`.toLowerCase();
  const compactText = normStr(rawText);

  // 1. Lottery check
  if (rawText.includes('lottery') || rawText.includes('lotto') || rawText.includes('scratch') || rawText.startsWith('sc-')) {
    return { group: 'Lottery', sub_category: 'Lottery', brand: 'Florida Lottery', confidence: 0.99, reason: 'Lottery keywords' };
  }

  // 2. Exact or substring match on canonical brands (from longest key to shortest)
  for (const [normKey, item] of NORMALIZED_LOOKUP.entries()) {
    if (normKey.length >= 4 && compactText.includes(normKey)) {
      return {
        group: item.group,
        sub_category: item.sub,
        brand: item.brand,
        confidence: 0.98,
        reason: `Matched brand ${item.brand}`
      };
    }
  }

  // 3. Typo-tolerant fuzzy matching on individual tokens & adjacent token pairs
  const words = rawText.match(/[a-z0-9]+/g) || [];
  const tokenPairs = [];
  for (let i = 0; i < words.length - 1; i++) {
    tokenPairs.push(words[i] + words[i + 1]);
  }
  const allTokens = [...words, ...tokenPairs];

  for (const tok of allTokens) {
    if (tok.length < 5) continue;
    for (const [normKey, item] of NORMALIZED_LOOKUP.entries()) {
      if (Math.abs(tok.length - normKey.length) <= 2) {
        const dist = levenshtein(tok, normKey);
        const maxDist = Math.min(tok.length, normKey.length) >= 8 ? 2 : 1;
        if (dist <= maxDist) {
          const conf = dist === 0 ? 0.98 : dist === 1 ? 0.94 : 0.89;
          return {
            group: item.group,
            sub_category: item.sub,
            brand: item.brand,
            confidence: conf,
            reason: `Fuzzy brand match ${item.brand} (edit distance ${dist})`
          };
        }
      }
    }
  }

  // 4. NRS Department: Beverages (Non-Alcoholic)
  if (department === 'Beverages' || /^(soda|juice|water|cola|tea|frappuccino|energy drink)/.test(rawText)) {
    if (!/(vodka|rum|gin|tequila|whiskey|whisky|bourbon|cognac|brandy|beer|wine|liqueur|schnapps|seltzer)/.test(rawText)) {
      return {
        group: 'Drinks & Mixers',
        sub_category: 'Drinks & Mixers',
        brand: brand || 'Generic',
        confidence: 0.95,
        reason: 'NRS Beverages department'
      };
    }
  }

  // 5. NRS Department: General Merchandise / Grocery
  if (department === 'General Merchandise') {
    if (/(chip|doritos|cheetos|lays|candy|snack|chocolate|pie|cookie|mussels|shrimp|sauce|detergent|peanut|seasoning|hot sauce|ice cream|ice bar|cone|cup|cups|condom|trojan|honey|patch|soup|noodle|ramen|soap|deodorant|oil|paper|shirt|vneck|tshirt|mask|freshmint)/.test(rawText)) {
      return {
        group: 'Snacks & Grocery',
        sub_category: 'Snacks & Grocery',
        brand: brand || 'Generic',
        confidence: 0.94,
        reason: 'NRS General Merchandise snack/grocery'
      };
    }
    if (/(wrap|hemp|rolling paper|leaf wrap|filter tip|loose leaf|grinder|pipe|lighter|butane|torch|ashtray)/.test(rawText)) {
      return {
        group: 'Tobacco',
        sub_category: 'Accessories',
        brand: brand || 'Generic',
        confidence: 0.95,
        reason: 'Smoking accessory'
      };
    }
    if (/(cigar|cigarillo|swisher|backwood|dutch|game|white owl|copenhagen|skoal|cheyenne)/.test(rawText)) {
      return {
        group: 'Tobacco',
        sub_category: 'Cigars/Cigarillos',
        brand: brand || 'Generic',
        confidence: 0.95,
        reason: 'Cigars/Cigarillos'
      };
    }
  }

  // 6. NRS Department: Beer
  if (department === 'Beer') {
    return {
      group: 'Beer & RTD',
      sub_category: 'Beer',
      brand: brand || 'Generic',
      confidence: 0.92,
      reason: 'NRS Beer department'
    };
  }

  // 7. Generic Keyword Fallbacks
  if (/(beer|lager|ale|ipa|stout|malt liquor|cider)/.test(rawText)) {
    return { group: 'Beer & RTD', sub_category: 'Beer', brand: brand || 'Generic', confidence: 0.90, reason: 'Beer keywords' };
  }
  if (/(wine|moscato|chardonnay|cabernet|merlot|pinot|sangria|prosecco|champagne)/.test(rawText)) {
    return { group: 'Wine', sub_category: 'Wine', brand: brand || 'Generic', confidence: 0.90, reason: 'Wine keywords' };
  }
  if (/(tequila|mezcal|reposado|blanco|anejo|añejo)/.test(rawText)) {
    return { group: 'Spirits', sub_category: 'Tequila/Mezcal', brand: brand || 'Generic', confidence: 0.90, reason: 'Tequila keywords' };
  }
  if (/(vodka)/.test(rawText)) {
    return { group: 'Spirits', sub_category: 'Vodka', brand: brand || 'Generic', confidence: 0.90, reason: 'Vodka keywords' };
  }
  if (/(whisky|whiskey|bourbon|scotch)/.test(rawText)) {
    return { group: 'Spirits', sub_category: 'Whiskey', brand: brand || 'Generic', confidence: 0.90, reason: 'Whiskey keywords' };
  }
  if (/(cognac|brandy)/.test(rawText)) {
    return { group: 'Spirits', sub_category: 'Cognac/Brandy', brand: brand || 'Generic', confidence: 0.90, reason: 'Cognac keywords' };
  }
  if (/(rum)/.test(rawText)) {
    return { group: 'Spirits', sub_category: 'Rum', brand: brand || 'Generic', confidence: 0.90, reason: 'Rum keywords' };
  }
  if (/(gin)/.test(rawText)) {
    return { group: 'Spirits', sub_category: 'Gin', brand: brand || 'Generic', confidence: 0.90, reason: 'Gin keywords' };
  }
  if (/(liqueur|cordial|schnapps|triple sec|amaretto)/.test(rawText)) {
    return { group: 'Spirits', sub_category: 'Liqueur', brand: brand || 'Generic', confidence: 0.90, reason: 'Liqueur keywords' };
  }

  // 8. Low-confidence fallback
  return null;
}

export function classifyNewProduct({ name, cleanName = '', department = '', brand = '', unitPrice = 0, upc = '' }) {
  const normU = String(upc || '').replace(/\D/g, '');
  if (normU.startsWith('798028') || /(payout|scratch|lotto|lottery)/i.test(name)) {
    return { category: 'Lottery', sub_category: 'Lottery', brand: 'Florida Lottery', department: 'Lottery' };
  }
  const res = classifyProductFull({ name, cleanName, department, brand, unitPrice });
  if (res) {
    return {
      category: res.group,
      sub_category: res.sub_category,
      brand: res.brand || brand || null,
      department: department || (res.group === 'Beer & RTD' ? 'Beer' : res.group === 'Drinks & Mixers' ? 'Beverages' : res.group === 'Tobacco' ? 'Tobacco' : res.group === 'Wine' ? 'Wine' : 'Liquor')
    };
  }
  // Fallbacks
  if (unitPrice >= 12.0 || department === 'Liquor') {
    return {
      category: 'Spirits',
      sub_category: 'Other Spirits – review',
      brand: brand || null,
      department: department || 'Liquor'
    };
  }
  return {
    category: 'Snacks & Grocery',
    sub_category: 'Snacks & Grocery',
    brand: brand || null,
    department: department || 'General Merchandise'
  };
}

