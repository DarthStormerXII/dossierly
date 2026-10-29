/* RECORDED FIXTURES. SAMPLE data (Arjun Raman, WSC-II-P.6151.48213.2026), hand-written stand-ins for model output.
   Used for replay when the daily model budget is spent, with no key under DEMO_FIXTURES=1, and in tests. */
import type { Language } from "../schemas";

export type ByLang<T = string> = Record<Language, T>;

export const OFFICIAL_LINES: Array<{ pl: string; tr: ByLang }> = [
  {
    pl: "Dzień dobry. Proszę o paszport i potwierdzenie opłaty skarbowej.",
    tr: {
      en: "Good morning. Please give me your passport and the proof of payment of the stamp duty.",
      uk: "Доброго дня. Будь ласка, дайте мені паспорт і підтвердження сплати гербового збору.",
      hi: "नमस्कार। कृपया अपना पासपोर्ट और स्टांप शुल्क के भुगतान की रसीद दीजिए।",
      ta: "வணக்கம். உங்கள் கடவுச்சீட்டையும் முத்திரைக் கட்டணம் செலுத்தியதற்கான ரசீதையும் தாருங்கள்.",
    },
  },
  {
    pl: "Decyzję może Pan odebrać do 14 listopada w pokoju 112, ale brakuje jednego zdjęcia.",
    tr: {
      en: "You can collect the decision by 14 November in room 112, but one photo is missing.",
      uk: "Рішення можна забрати до 14 листопада в кімнаті 112, але бракує однієї фотографії.",
      hi: "आप निर्णय 14 नवंबर तक कमरा 112 में ले सकते हैं, लेकिन एक फोटो कम है।",
      ta: "முடிவை நவம்பர் 14க்குள் அறை 112 இல் பெறலாம், ஆனால் ஒரு புகைப்படம் குறைவாக உள்ளது.",
    },
  },
  {
    pl: "Czy ma Pan aktualną umowę najmu?",
    tr: {
      en: "Do you have a current rental agreement?",
      uk: "Чи є у вас чинний договір оренди?",
      hi: "क्या आपके पास किराये का वर्तमान अनुबंध है?",
      ta: "உங்களிடம் தற்போதைய வாடகை ஒப்பந்தம் உள்ளதா?",
    },
  },
];

export const USER_LINES: Array<{ keys: string[]; pl: string; advice?: boolean }> = [
  { keys: ["i have my passport. where do i pay the fee?"], pl: "Mam paszport. Gdzie mogę zapłacić opłatę?" },
  { keys: ["yes", "так", "हाँ", "ஆம்"], pl: "Tak." },
  { keys: ["yes, i do. i will bring a copy tomorrow."], pl: "Tak, mam. Jutro przyniosę kopię." },
  { keys: ["should i sign this contract? is it legal?"], pl: "Czy powinienem podpisać tę umowę? Czy to jest zgodne z prawem?", advice: true },
  { keys: ["so the decision is ready by 14 november, correct?"], pl: "Czyli decyzja będzie gotowa do 14 listopada, tak?" },
];

export const CLARIFY_14_NOV = {
  kind: "date" as const,
  quote: "do 14 listopada",
  explanation: {
    en: "\"By 14 November\" means any day up to the 14th, not only on that day. The official also mentioned a missing photo but did not say what to do about it.",
    uk: "\"До 14 листопада\" означає будь-який день до 14-го, а не лише цей день. Посадовець також згадав, що бракує фотографії, але не сказав, що робити.",
    hi: "\"14 नवंबर तक\" का मतलब है 14 तारीख़ तक का कोई भी दिन, केवल उसी दिन नहीं। अधिकारी ने एक फोटो कम होने की बात भी कही, पर यह नहीं बताया कि क्या करना है।",
    ta: "\"நவம்பர் 14க்குள்\" என்றால் 14 வரை எந்த நாளும், அந்த நாள் மட்டும் அல்ல. ஒரு புகைப்படம் குறைவு என்றும் சொன்னார்கள், ஆனால் என்ன செய்ய வேண்டும் என்று சொல்லவில்லை.",
  } as ByLang,
  clarifyLocal: "Czy może Pan powtórzyć, do kiedy dokładnie mogę odebrać decyzję i jakie zdjęcie mam dostarczyć?",
  clarifyUser: {
    en: "Could you repeat the exact date I can collect the decision, and which photo I need to bring?",
    uk: "Чи можете повторити, до якої саме дати я можу забрати рішення і яку фотографію принести?",
    hi: "क्या आप दोहरा सकते हैं कि मैं निर्णय ठीक किस तारीख़ तक ले सकता हूँ और कौन सी फोटो लानी है?",
    ta: "முடிவை எந்த தேதி வரை பெறலாம், எந்த புகைப்படம் கொண்டுவர வேண்டும் என்று மீண்டும் சொல்ல முடியுமா?",
  } as ByLang,
};

export const WRAP: ByLang<{ headline: string; agreed: string[]; bring: string[]; what: string; open: string[] }> = {
  en: {
    headline: "Your fingerprints were taken. One photo and a copy of the rental agreement are still needed.",
    agreed: ["The passport and the stamp duty receipt were checked", "Fingerprints were taken", "One biometric photo is missing"],
    bring: ["One new biometric photo, 35 x 45 mm", "A copy of the current rental agreement", "Passport"],
    what: "Collect the decision in room 112",
    open: ["Which exact photo is missing was not made clear"],
  },
  uk: {
    headline: "Відбитки пальців взято. Ще потрібні одна фотографія і копія договору оренди.",
    agreed: ["Паспорт і квитанцію про гербовий збір перевірено", "Відбитки пальців взято", "Бракує однієї біометричної фотографії"],
    bring: ["Одна нова біометрична фотографія, 35 x 45 мм", "Копія чинного договору оренди", "Паспорт"],
    what: "Забрати рішення в кімнаті 112",
    open: ["Не з'ясовано, якої саме фотографії бракує"],
  },
  hi: {
    headline: "आपके फ़िंगरप्रिंट लिए जा चुके हैं। एक फोटो और किराये के अनुबंध की प्रति अभी चाहिए।",
    agreed: ["पासपोर्ट और स्टांप शुल्क की रसीद जाँची गई", "फ़िंगरप्रिंट लिए गए", "एक बायोमेट्रिक फोटो कम है"],
    bring: ["एक नई बायोमेट्रिक फोटो, 35 x 45 मिमी", "किराये के वर्तमान अनुबंध की प्रति", "पासपोर्ट"],
    what: "कमरा 112 से निर्णय लें",
    open: ["कौन सी फोटो कम है, यह साफ़ नहीं हुआ"],
  },
  ta: {
    headline: "உங்கள் கைரேகைகள் எடுக்கப்பட்டன. ஒரு புகைப்படமும் வாடகை ஒப்பந்த நகலும் இன்னும் தேவை.",
    agreed: ["கடவுச்சீட்டும் முத்திரைக் கட்டண ரசீதும் சரிபார்க்கப்பட்டன", "கைரேகைகள் எடுக்கப்பட்டன", "ஒரு பயோமெட்ரிக் புகைப்படம் குறைவு"],
    bring: ["ஒரு புதிய பயோமெட்ரிக் புகைப்படம், 35 x 45 மிமீ", "தற்போதைய வாடகை ஒப்பந்த நகல்", "கடவுச்சீட்டு"],
    what: "அறை 112 இல் முடிவைப் பெறுங்கள்",
    open: ["எந்த புகைப்படம் குறைவு என்பது தெளிவாகவில்லை"],
  },
};

export const LETTER: ByLang<{ title: string; asks: string[]; labels: Array<[string, string, string]> }> = {
  en: {
    title: "Request to supplement formal deficiencies",
    asks: ["Send a current rental agreement or other proof of address", "Send proof of health insurance for the whole stay", "Send a full copy of the passport"],
    labels: [
      ["Numer sprawy", "Case number", "Copy it from the top right of the letter into every reply"],
      ["Adres zamieszkania", "Residential address", "Your current address in Poland, as on the rental agreement"],
      ["Podpis", "Signature", "Sign by hand at the bottom, as in your passport"],
    ],
  },
  uk: {
    title: "Вимога усунути формальні недоліки заяви",
    asks: ["Надіслати чинний договір оренди або інший документ, що підтверджує адресу", "Надіслати підтвердження медичного страхування на весь період перебування", "Надіслати повну копію паспорта"],
    labels: [
      ["Numer sprawy", "Номер справи", "Перепишіть його з правого верхнього кута листа в кожну відповідь"],
      ["Adres zamieszkania", "Адреса проживання", "Ваша поточна адреса в Польщі, як у договорі оренди"],
      ["Podpis", "Підпис", "Підпишіть від руки внизу, як у паспорті"],
    ],
  },
  hi: {
    title: "औपचारिक कमियाँ पूरी करने का अनुरोध",
    asks: ["किराये का वर्तमान अनुबंध या पते का कोई अन्य प्रमाण भेजें", "पूरे प्रवास के लिए स्वास्थ्य बीमा का प्रमाण भेजें", "पासपोर्ट की पूरी प्रति भेजें"],
    labels: [
      ["Numer sprawy", "केस नंबर", "पत्र के ऊपर दाईं ओर से हर उत्तर में लिखें"],
      ["Adres zamieszkania", "निवास का पता", "पोलैंड में आपका वर्तमान पता, जैसा किराये के अनुबंध में है"],
      ["Podpis", "हस्ताक्षर", "नीचे हाथ से हस्ताक्षर करें, पासपोर्ट जैसे"],
    ],
  },
  ta: {
    title: "முறையான குறைபாடுகளை நிரப்பக் கோரிக்கை",
    asks: ["தற்போதைய வாடகை ஒப்பந்தம் அல்லது வேறு முகவரிச் சான்று அனுப்புங்கள்", "முழு தங்கும் காலத்திற்கான சுகாதாரக் காப்பீட்டுச் சான்று அனுப்புங்கள்", "கடவுச்சீட்டின் முழு நகல் அனுப்புங்கள்"],
    labels: [
      ["Numer sprawy", "வழக்கு எண்", "கடிதத்தின் மேல் வலதுபுறம் உள்ளதை ஒவ்வொரு பதிலிலும் எழுதுங்கள்"],
      ["Adres zamieszkania", "வசிப்பிட முகவரி", "வாடகை ஒப்பந்தத்தில் உள்ளபடி போலந்தில் உங்கள் தற்போதைய முகவரி"],
      ["Podpis", "கையொப்பம்", "கீழே கையால் கையொப்பமிடுங்கள், கடவுச்சீட்டில் உள்ளது போல"],
    ],
  },
};

export const LINK: ByLang<{ explanation: string; open: string[]; draftUser: string }> = {
  en: {
    explanation: "This letter follows your fingerprint appointment on 18 September. It asks for documents the office needs to finish your application.",
    open: ["Rental agreement copy", "Proof of health insurance", "Full passport copy"],
    draftUser: "Dear Sir or Madam, in reply to the request in case WSC-II-P.6151.48213.2026 I enclose a current rental agreement, proof of health insurance and a full copy of my passport. Kind regards, Arjun Raman.",
  },
  uk: {
    explanation: "Цей лист стосується вашого прийому для зняття відбитків пальців 18 вересня. У ньому просять документи, потрібні відомству для завершення розгляду вашої заяви.",
    open: ["Копія договору оренди", "Підтвердження медичного страхування", "Повна копія паспорта"],
    draftUser: "Шановні пані та панове, у відповідь на вимогу у справі WSC-II-P.6151.48213.2026 додаю чинний договір оренди, підтвердження медичного страхування та повну копію паспорта. З повагою, Arjun Raman.",
  },
  hi: {
    explanation: "यह पत्र 18 सितंबर को हुए आपके फ़िंगरप्रिंट अपॉइंटमेंट के बाद का है। इसमें वे दस्तावेज़ माँगे गए हैं जो कार्यालय को आपका आवेदन पूरा करने के लिए चाहिए।",
    open: ["किराये के अनुबंध की प्रति", "स्वास्थ्य बीमा का प्रमाण", "पासपोर्ट की पूरी प्रति"],
    draftUser: "महोदय/महोदया, मामले WSC-II-P.6151.48213.2026 में अनुरोध के उत्तर में मैं किराये का वर्तमान अनुबंध, स्वास्थ्य बीमा का प्रमाण और पासपोर्ट की पूरी प्रति संलग्न कर रहा हूँ। सादर, Arjun Raman।",
  },
  ta: {
    explanation: "இந்தக் கடிதம் செப்டம்பர் 18 அன்று நடந்த உங்கள் கைரேகை சந்திப்பைத் தொடர்ந்தது. உங்கள் விண்ணப்பத்தை முடிக்க அலுவலகத்திற்குத் தேவையான ஆவணங்களை இது கேட்கிறது.",
    open: ["வாடகை ஒப்பந்த நகல்", "சுகாதாரக் காப்பீட்டுச் சான்று", "கடவுச்சீட்டின் முழு நகல்"],
    draftUser: "ஐயா/அம்மணி, வழக்கு WSC-II-P.6151.48213.2026 இல் உள்ள கோரிக்கைக்குப் பதிலாக, தற்போதைய வாடகை ஒப்பந்தம், சுகாதாரக் காப்பீட்டுச் சான்று மற்றும் கடவுச்சீட்டின் முழு நகலை இணைக்கிறேன். மரியாதையுடன், Arjun Raman.",
  },
};

export const DRAFT_LOCAL =
  "Szanowni Państwo,\n\nw odpowiedzi na wezwanie do uzupełnienia braków formalnych w sprawie WSC-II-P.6151.48213.2026 przesyłam w załączeniu: aktualną umowę najmu, potwierdzenie ubezpieczenia zdrowotnego oraz pełną kopię paszportu.\n\nZ poważaniem,\nArjun Raman";
