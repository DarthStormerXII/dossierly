import type { Need } from "./content";

// Structure inspected from this actual Mazowiecki public letter; all case content below is fictional.
export const layoutReference = "https://www.gov.pl/attachment/067ebc20-cde4-447a-b724-0f997a22284b";
type Evidence = { label: string; text: string; explanation: string };
type Paper = { heading: string; subject: string; intro: string; request: Evidence; detail: Evidence; items: string[]; closing: string; attachment: string };
export const paperStories: Record<Need, Paper> = {
  letters: {
    heading: "Pismo w sprawie dokumentów", subject: "Uzupełnienie dokumentacji w sprawie pobytowej",
    intro: "W związku z prowadzoną sprawą dotyczącą pobytu czasowego prosimy o uzupełnienie dokumentacji. W przekazanych materiałach nie odnaleziono czytelnej kopii potwierdzenia ubezpieczenia zdrowotnego.",
    request: { label: "Requested document", text: "kopii potwierdzenia ubezpieczenia zdrowotnego", explanation: "The fictional letter asks for a copy of the health insurance confirmation. Check the complete original and the office’s instructions before choosing which document to provide." },
    detail: { label: "Date in the source", text: "18 listopada 2026 r.", explanation: "18 November 2026 is a fictional date written into this example. It is not a general legal deadline. In a real case, use the terms in the letter you actually received." },
    items: ["sprawdzić czytelność danych na kopii dokumentu;", "oznaczyć odpowiedź podanym wyżej numerem sprawy;", "zachować kopię pisma oraz potwierdzenie przekazania dokumentu."],
    closing: "W razie wątpliwości dotyczących wskazanego dokumentu prosimy o kontakt z wydziałem i podanie numeru sprawy. Ułatwi to odnalezienie właściwej korespondencji.",
    attachment: "Przykładowa lista kontrolna dokumentów — 1 strona",
  },
  documents: {
    heading: "Lista kontrolna dokumentów", subject: "Materiały do omówienia przed złożeniem dokumentacji",
    intro: "Arjun przygotowuje teczkę do rozmowy o swojej sprawie. Poniższa lista jest notatką roboczą, a nie urzędowym wykazem wymaganych dokumentów.",
    request: { label: "Item to clarify", text: "Potwierdzenie ubezpieczenia zdrowotnego — do wyjaśnienia", explanation: "This checklist separates an uncertain item from documents already prepared. Confirm the accepted insurance evidence against the office’s current instructions." },
    detail: { label: "Checklist note", text: "Rodzaj dokumentu wymaga potwierdzenia w aktualnej instrukcji urzędu.", explanation: "The source explicitly says the document type is unconfirmed. The next step is to clarify it, not to treat this sample list as an official requirement." },
    items: ["Formularz roboczy — przygotowany do sprawdzenia", "Fotografia — do porównania z aktualnymi wymaganiami", "Kopie dokumentów — uporządkowane w teczce"],
    closing: "Przy każdej niejasnej pozycji zapisz pytanie do urzędu. Nie traktuj tej listy jako kompletnego zestawu dokumentów dla rzeczywistej sprawy.",
    attachment: "Miejsce na własne pytania — notatka przykładowa",
  },
  deadlines: {
    heading: "Potwierdzenie terminu — przykład", subject: "Przykładowa wizyta informacyjna",
    intro: "W fikcyjnym scenariuszu Arjun otrzymał potwierdzenie wizyty informacyjnej. Dokument służy do pokazania, jak odróżnić termin spotkania od terminu przekazania dokumentów.",
    request: { label: "Appointment type", text: "Wizyta informacyjna dotycząca dokumentacji", explanation: "This is an information appointment in the sample. It does not establish a filing deadline or confirm that an application has been approved." },
    detail: { label: "Date in the source", text: "18 listopada 2026 r., godz. 10:30", explanation: "The sample appointment is 18 November 2026 at 10:30. Review the date and location before choosing a reminder; this preview cannot create calendar events." },
    items: ["Sprawdź miejsce spotkania w autentycznym potwierdzeniu.", "Przygotuj pytania, które chcesz omówić.", "Zaplanuj czas na dojazd oraz sprawdzenie informacji."],
    closing: "Przed ustawieniem przypomnienia porównaj wszystkie dane z oryginalnym potwierdzeniem. W tym przykładzie nie dokonano żadnej rezerwacji.",
    attachment: "Przykładowa notatka do przypomnienia",
  },
  appointments: {
    heading: "Notatka przed wizytą", subject: "Pytania Arjuna do rozmowy z urzędem",
    intro: "Celem przykładowej rozmowy jest wyjaśnienie, czy w dokumentacji brakuje dodatkowych informacji. Arjun chce przygotować krótką listę pytań przed spotkaniem.",
    request: { label: "Visit purpose", text: "Wyjaśnienie brakujących dokumentów i sposobu ich przekazania", explanation: "The goal is to clarify what is missing and how to provide it. A short question list helps keep the conversation focused without assuming the answer." },
    detail: { label: "Visit detail", text: "18 listopada 2026 r., godz. 10:30 — termin przykładowy", explanation: "This is a fictional visit time for the walkthrough. It does not book an appointment or establish which office handles your real case." },
    items: ["Jakich dokumentów jeszcze brakuje?", "W jaki sposób mogę je przekazać?", "Gdzie znajdę te wskazówki na piśmie?"],
    closing: "Po rozmowie warto zapisać odpowiedzi i wskazane źródła informacji. Ta notatka nie zastępuje potwierdzenia wizyty ani instrukcji urzędu.",
    attachment: "Miejsce na odpowiedzi — notatka robocza",
  },
  communicate: {
    heading: "Projekt wiadomości", subject: "Prośba o potwierdzenie otrzymania dokumentów",
    intro: "Szanowni Państwo, w nawiązaniu do przykładowej sprawy PRZYKŁAD/2026/0142 zwracam się z uprzejmą prośbą o informację dotyczącą przekazanych dokumentów.",
    request: { label: "Phrase in the source", text: "Czy mogą Państwo potwierdzić otrzymanie moich dokumentów?", explanation: "“Could you confirm that you have received my documents?” This asks for receipt confirmation; it does not presume approval." },
    detail: { label: "Follow-up question", text: "Proszę również o informację, czy potrzebne są dodatkowe dokumenty.", explanation: "The follow-up asks whether anything else is needed. Review the wording and add your real reference only when preparing an actual message yourself." },
    items: ["Sprawdź odbiorcę przed wysłaniem prawdziwej wiadomości.", "Porównaj numer sprawy z własną korespondencją.", "Nie dodawaj danych, które nie są potrzebne do pytania."],
    closing: "Dziękuję za pomoc. Z poważaniem, Arjun Mehta — fikcyjny autor przykładowej wiadomości. Ten projekt nie został wysłany.",
    attachment: "Brak — projekt wiadomości w podglądzie",
  },
  updates: {
    heading: "Przykładowy przebieg sprawy", subject: "Notatka o zmianie statusu dokumentacji",
    intro: "Arjun porównuje nową informację z wcześniejszymi notatkami dotyczącymi fikcyjnej sprawy. Poniższy zapis ilustruje zmianę statusu, a nie wynik postępowania.",
    request: { label: "Status in the source", text: "Dokumenty otrzymane", explanation: "“Documents received” confirms receipt in this sample. It does not say that a decision has been made." },
    detail: { label: "Update date", text: "2 listopada 2026 r. — brak informacji o decyzji", explanation: "The sample records an update on 2 November 2026 and explicitly has no decision information. Keep confirmed facts separate from unknowns." },
    items: ["30 października — przygotowanie przykładowych dokumentów", "2 listopada — odnotowanie otrzymania dokumentów", "Dalsze instrukcje — brak w tym przykładzie"],
    closing: "Zachowaj treść oryginalnej aktualizacji i sprawdź, czy zawiera dodatkowe prośby. Nie wyciągaj wniosku o pozytywnej decyzji wyłącznie ze statusu otrzymania dokumentów.",
    attachment: "Przykładowa oś zdarzeń — 1 strona",
  },
};
