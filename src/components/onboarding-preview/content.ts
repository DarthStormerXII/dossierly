export const languages = [
  { value: "en", label: "English", phrase: "One step at a time." },
  { value: "uk", label: "Українська · Ukrainian", phrase: "Крок за кроком." },
  { value: "ru", label: "Русский · Russian", phrase: "Шаг за шагом." },
  { value: "hi", label: "हिन्दी · Hindi", phrase: "एक समय में एक कदम।" },
  { value: "ta", label: "தமிழ் · Tamil", phrase: "ஒரு நேரத்தில் ஒரு படி." },
  { value: "zh", label: "中文 · Chinese", phrase: "一步一步来。" },
  { value: "ja", label: "日本語 · Japanese", phrase: "一歩ずつ。" },
  { value: "vi", label: "Tiếng Việt · Vietnamese", phrase: "Từng bước một." },
];

export const reasons = ["Work", "Study", "Family", "Business", "Other"];
export const stages = ["Planning to move", "Recently arrived", "Preparing an application", "Waiting for a decision", "Renewing", "Not sure"];
export const needs = [
  { value: "letters", label: "Understand letters", description: "Know what a letter is asking you to do." },
  { value: "documents", label: "Prepare documents", description: "Make the next checklist less daunting." },
  { value: "deadlines", label: "Track deadlines", description: "Keep important dates in view." },
  { value: "appointments", label: "Prepare for appointments", description: "Arrive with the right questions." },
  { value: "communicate", label: "Communicate with the office", description: "Find the words for your next conversation." },
  { value: "updates", label: "Follow application updates", description: "Understand what has changed." },
] as const;
export type Need = (typeof needs)[number]["value"];
export type { Tool } from "./providers";
export type Answers = { name: string; language: string; reason: string; stage: string; city: string; office: string; needs: Need[]; main: Need | "" };
export const emptyAnswers = (): Answers => ({ name: "", language: "en", reason: "", stage: "", city: "", office: "", needs: [], main: "" });
export const officeRelevant = (stage: string) => ["Preparing an application", "Waiting for a decision", "Renewing"].includes(stage);
export const needLabel = (need: Need | "") => needs.find((item) => item.value === need)?.label ?? "Choose a priority";

type Sample = {
  title: string; kind: string; before: string; evidence: string; after: string;
  evidenceLabel: string; explanation: string; actionLabel: string; action: string; firstAction: string; plan: string[];
};
export const samples: Record<Need, Sample> = {
  letters: {
    title: "A letter asking for one more document", kind: "Sample letter · Polish original",
    before: "Prosimy o dostarczenie kopii potwierdzenia ubezpieczenia zdrowotnego do dnia ", evidence: "18 listopada 2026 r.", after: "",
    evidenceLabel: "Date in the source", explanation: "This sample asks for a copy of your health insurance confirmation. It states 18 November 2026 as the date to provide it. Check the complete letter and delivery instructions before acting.",
    actionLabel: "Suggested next step", action: "Check which insurance document is requested and how the office accepts it. Prepare the copy before 18 November 2026.",
    firstAction: "Understand your first letter", plan: ["Choose the letter you want to understand", "Review the request alongside the original", "Decide on the next step before any action"],
  },
  documents: {
    title: "A checklist with one item to clarify", kind: "Sample document checklist",
    before: "For the sample appointment: application form, photo, and ", evidence: "proof of health insurance", after: " — document type still to be confirmed.",
    evidenceLabel: "Item to clarify", explanation: "The sample checklist has one unresolved item. Before gathering more documents, check which form of insurance evidence this office accepts. This is an example, not an official checklist.",
    actionLabel: "Your sample checklist item", action: "Check the official document list and confirm which proof of health insurance is accepted. Keep a copy with the appointment documents.",
    firstAction: "Start a document checklist", plan: ["Choose the process you are preparing for", "Compare your documents with the office’s current list", "Keep uncertain items separate until confirmed"],
  },
  deadlines: {
    title: "A date worth keeping in view", kind: "Sample appointment confirmation",
    before: "Your appointment is scheduled for ", evidence: "18 November 2026 at 10:30", after: ". Please check the location in your confirmation.",
    evidenceLabel: "Date in the source", explanation: "The sample contains an appointment time, not a filing deadline. Review the date and location before choosing a reminder. No calendar event is created in this preview.",
    actionLabel: "Your sample reminder", action: "Review the appointment for 18 November 2026 at 10:30. Check the location and prepare what to bring the day before.",
    firstAction: "Review an important date", plan: ["Find the date in its original source", "Confirm what the date refers to", "Choose a reminder after reviewing it"],
  },
  appointments: {
    title: "A calmer first office visit", kind: "Sample visit notes",
    before: "Information desk · appointment on ", evidence: "18 November 2026 at 10:30", after: ". You want to check what is missing from your application.",
    evidenceLabel: "Visit detail", explanation: "A short question list can make the visit easier. Start with what is missing, how to submit it, and where to find written instructions. The sample does not book an appointment.",
    actionLabel: "Your sample question list", action: "Which documents are still missing? How should I submit them? Could you show me where these instructions are written?",
    firstAction: "Prepare your office questions", plan: ["Add the purpose of your visit", "Make a short list of questions", "Review the details before you go"],
  },
  communicate: {
    title: "A clear question for the office", kind: "Sample phrase · Polish",
    before: "You want to ask: ", evidence: "Czy mogą Państwo potwierdzić otrzymanie moich dokumentów?", after: "",
    evidenceLabel: "Phrase in the source", explanation: "This means: “Could you confirm that you have received my documents?” It asks for confirmation without assuming the application has been approved. Nothing is sent in this preview.",
    actionLabel: "Your sample message", action: "Hello, could you please confirm that you have received my documents? Please let me know if anything else is needed. Thank you.",
    firstAction: "Prepare a question for the office", plan: ["Describe what you need to ask", "Review the wording in context", "Decide whether and how to send it yourself"],
  },
  updates: {
    title: "An update, without the guesswork", kind: "Sample application timeline",
    before: "2 November 2026 · status changed to ", evidence: "Documents received", after: ". No decision is shown.",
    evidenceLabel: "Status in the source", explanation: "This sample confirms receipt of documents. It does not say that a decision has been made. Keep the original update and check for any separate instructions.",
    actionLabel: "Your sample follow-up note", action: "Keep the “Documents received” update with its date. Check the original message for any additional requests before deciding whether to follow up.",
    firstAction: "Review your latest update", plan: ["Choose an update you want to understand", "Separate confirmed changes from unknowns", "Keep any follow-up linked to its source"],
  },
};

export const steps = [
  { label: "Your details", title: "Let’s make this feel like yours", description: "A little context helps Dossierly start in the right place." },
  { label: "Your situation", title: "Where are you in your journey?", description: "There’s no perfect answer. Choose what feels closest today." },
  { label: "Your priorities", title: "What would make things easier?", description: "Choose the help you need. We’ll start with what matters most." },
  { label: "Your examples", title: "From the original to your next step", description: "Explore every kind of help you chose, starting with your main priority." },
  { label: "Optional tools", title: "Bring your useful things together", description: "One mail provider. One calendar. Both optional, and both still a setup preview." },
];
