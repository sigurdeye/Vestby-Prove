// High-frequency wods in Bokmål and their Nynorsk equivalents
// This is used as harper does for example not suggest "eg" for "jeg", likely due to how its built
const bokmaalToNynorsk: Record<string, string> = {
    // Pronouns
    "jeg": "eg",
    "vi": "me",
    "dere": "de",
    "hun": "ho",
    "ham": "han",
    "de": "dei",
    "sin": "sin",
    "sine": "sine",
    "min": "mi",
    "mine": "mine",
    "din": "di",
    "dine": "dine",
    "hans": "hans",
    "hennes": "hennar",
    "det": "det",
    "den": "den",
    "oss": "oss",
    "noen": "nokon",
    "noe": "noko",

    // Articles
    "en": "ein",
    "et": "eit",

    // Negation / adverbs
    "ikke": "ikkje",
    "nå": "no",
    "bare": "berre",
    "mye": "mykje",
    "da": "då",
    "allerede": "allereie",
    "videre": "vidare",
    "ennå": "enno",
    "enda": "endå",
    "sammen": "saman",

    // Conjunctions / subordinators
    "hvis": "viss",
    "mens": "medan",
    "siden": "sidan",

    // Interrogatives
    "hvor": "kvar",
    "hvorfor": "kvifor",
    "hvordan": "korleis",
    "hvem": "kven",

    // High-frequency verbs
    "være": "vere",
    "gjøre": "gjere",
    "komme": "kome",
    "se": "sjå",
    "gi": "gje",
    "si": "seie",
    "fortelle": "fortelje",
    "spørre": "spørje",
    "sette": "setje",
    "ligge": "liggje",
    "sitte": "sitje",
    "holde": "halde",
    "følge": "følgje",
    "begynne": "byrje",
    "selge": "selje",
    "høre": "høyre",
    "tro": "tru",
    "mene": "meine",
    "tenke": "tenkje",
    "hete": "heite",
    "ønske": "ønskje",
    "legge": "leggje",
    "trekke": "trekkje",
    "løfte": "lyfte",
    "bære": "bere",
    "vokse": "vekse",
    "dø": "døy",
    "spille": "spele",
    "synge": "syngje",
    "leke": "leike",
    "glemme": "gløyme",

    // Common adjectives
    "gammel": "gammal",
    "dårlig": "dårleg",
    "høy": "høg",
    "lav": "låg",
    "åpen": "open",
};

export default bokmaalToNynorsk;