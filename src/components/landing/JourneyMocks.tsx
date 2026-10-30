import { Icon } from "@/components/Icon";

/** Mini UI mockups for the journey. Real HTML, sample data from Arjun's (fictional) case. */

export function PrepareMock() {
  const items = [
    { t: "Passport, all pages", ok: true },
    { t: "Photo 35×45 mm", ok: true },
    { t: "Card fee receipt 100 zł", ok: true },
    { t: "Proof of health insurance for the whole stay", ok: false },
  ];
  return (
    <div className="lp-mock lp-mock-prepare" aria-label="Preparation checklist for Arjun's next visit">
      <div className="lp-mock-head">
        <span className="lp-mini-label">Next visit · Marszałkowska 3/5</span>
        <span className="lp-pill-sm">3 of 4</span>
      </div>
      <ul className="lp-check">
        {items.map((i) => (
          <li key={i.t} className={i.ok ? "is-ok" : "is-miss"}>
            <span className="lp-check-ic" aria-hidden="true">{i.ok ? <Icon name="check" size={14} /> : "!"}</span>
            <span>{i.t}<span className="sr-only">{i.ok ? ", already in your case" : ", missing"}</span></span>
          </li>
        ))}
      </ul>
      <p className="lp-cite"><Icon name="link" size={14} /> Each line cites the paragraph on migrant.wsc.mazowieckie.pl</p>
    </div>
  );
}

export function ChangeMock() {
  return (
    <div className="lp-mock lp-mock-small lp-mock-change" aria-label="What changed since you last prepared">
      <span className="lp-mini-label">Changed since you last prepared</span>
      <p>19 Oct 2026: a certificate now replaces the passport stamp.</p>
    </div>
  );
}

export function TableMock() {
  return (
    <div className="lp-phone" aria-label="Table mode: the phone lies flat between you and the official">
      <div className="lp-phone-half lp-phone-off">
        <span className="lp-turn-who">Urzędnik · po polsku</span>
        <p lang="pl">„Brakuje potwierdzenia ubezpieczenia zdrowotnego. Przyjdzie pismo.”</p>
      </div>
      <div className="lp-phone-divider" aria-hidden="true"><Icon name="flip" size={14} /></div>
      <div className="lp-phone-half lp-phone-you">
        <span className="lp-turn-who">You · English</span>
        <p>Proof of health insurance is missing. A letter will follow.</p>
        <div className="lp-phone-btns" aria-hidden="true">
          <span className="lp-round lp-round-off"><Icon name="mic" size={18} /></span>
          <span className="lp-round lp-round-you"><Icon name="mic" size={18} /></span>
        </div>
      </div>
    </div>
  );
}

export function WatcherMock() {
  return (
    <div className="lp-mock lp-mock-small lp-mock-watch" aria-label="The watcher speaks up">
      <span className="lp-mini-label"><span className="lp-live" aria-hidden="true" />Watcher</span>
      <p>A number of days could be misheard. Ask before you leave:</p>
      <p className="lp-ask" lang="pl">„Czy chodzi o czternaście dni?”</p>
      <p className="lp-ask-en">Do you mean fourteen days?</p>
    </div>
  );
}

export function WrapUpMock() {
  return (
    <div className="lp-mock lp-mock-wrap" aria-label="Wrap-up after the visit on Friday 18 September">
      <div className="lp-mock-head">
        <span className="lp-mini-label">Wrap-up · Fri 18 Sep · fingerprints</span>
        <span className="lp-pill-sm lp-pill-ok"><Icon name="lock" size={12} /> Saved to your case</span>
      </div>
      <dl className="lp-wrapup">
        <div><dt>Agreed</dt><dd>Fingerprints taken. Passport, photo and fee receipts accepted.</dd></div>
        <div><dt>To bring</dt><dd>Proof of health insurance for the whole stay.</dd></div>
        <div><dt>Dates named</dt><dd>None yet. A letter will follow by e-Doręczenia or post.</dd></div>
      </dl>
      <div className="lp-mock-actions" aria-hidden="true">
        <span className="lp-chip-ui lp-chip-dark"><Icon name="calendar" size={14} /> Add to calendar</span>
        <span className="lp-chip-ui">Filed to your agent&apos;s memory</span>
      </div>
    </div>
  );
}

export function LetterMock() {
  const steps = [
    "Delivered Tue 27 Oct. The day of delivery is not counted.",
    "Day 1 is Wed 28 Oct.",
    "Day 14 is Tue 10 Nov, a working day.",
  ];
  return (
    <div className="lp-mock lp-mock-letter" aria-label="Arjun's letter, read and linked">
      <div className="lp-mock-head">
        <span className="lp-mini-label">Letter · wezwanie</span>
        <span className="lp-pill-sm lp-pill-off">Polish verbatim</span>
      </div>
      <p className="lp-verbatim" lang="pl">„…w terminie 14 dni od dnia doręczenia niniejszego wezwania…”</p>
      <p className="lp-linked"><Icon name="link" size={15} /> Linked to 18 Sep: the official said this letter would come.</p>
      <div className="lp-dl-box">
        <span className="lp-mini-label lp-red">Reply by</span>
        <p className="lp-dl-mid">Tuesday 10 November 2026</p>
        <ol className="lp-steps">
          {steps.map((s, i) => <li key={s} style={{ transitionDelay: `${300 + i * 160}ms` }}>{s}</li>)}
        </ol>
      </div>
    </div>
  );
}

export function DraftMock() {
  return (
    <div className="lp-mock lp-mock-small lp-mock-draft" aria-label="A Polish cover letter, drafted">
      <span className="lp-mini-label"><Icon name="file" size={13} /> Draft reply · Polish</span>
      <p lang="pl">W odpowiedzi na wezwanie doręczone 27 października 2026 r. przedkładam potwierdzenie ubezpieczenia zdrowotnego…</p>
    </div>
  );
}
