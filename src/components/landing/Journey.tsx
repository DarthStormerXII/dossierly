import type { ReactNode } from "react";
import { PhotoCard, type PhotoTone } from "./Photo";
import { ChangeMock, DraftMock, LetterMock, PrepareMock, TableMock, WatcherMock, WrapUpMock } from "./JourneyMocks";

type Step = {
  id: string; tag: string; name: string; title: string; body: string; models: string[];
  photo?: { src: string; alt: string; tone: PhotoTone }; main: ReactNode; aside?: ReactNode;
};

const STEPS: Step[] = [
  {
    id: "before", tag: "Before", name: "Prepare",
    title: "Walk in knowing exactly what to bring.",
    body: "Your agent reads today's official pages for your office and writes a checklist for the next appointment. Every line cites the exact paragraph and is ticked against what your case already holds. You also get the Polish phrases you will need, and what changed since you last prepared.",
    models: ["Your private agent · Nemotron 3.5 Super VL", "Tavily", "Nemotron embeddings"],
    photo: { src: "/landing/office-counter.jpg", alt: "A service counter at a foreigners' office, with a queue ticket on the desk", tone: "counter" },
    main: <PrepareMock />, aside: <ChangeMock />,
  },
  {
    id: "during", tag: "During", name: "Meet",
    title: "Two languages, one phone lying flat on the desk.",
    body: "An introduction card first, then two-way interpreting in table mode: the official's half of the screen faces them, in Polish. A watcher speaks up when a date, an amount or a document could be misunderstood, with a ready question in Polish.",
    models: ["Nemotron 3.5 Lightning", "Super VL for Ukrainian, Hindi, Tamil", "Super VL watcher"],
    photo: { src: "/landing/table-mode.jpg", alt: "A phone lying flat on a desk between an applicant and an official", tone: "table" },
    main: <TableMock />, aside: <WatcherMock />,
  },
  {
    id: "after", tag: "After", name: "Wrap-up",
    title: "Leave with the visit written down.",
    body: "What was agreed, what to bring, which dates were named. The wrap-up is filed into your agent's memory and your calendar, so the next step starts from what actually happened.",
    models: ["Nemotron 3.5 Super VL"],
    main: <WrapUpMock />,
  },
  {
    id: "letters", tag: "Letters", name: "Read, link, reply",
    title: "The letter arrives. Your case already knows why.",
    body: "Photograph the letter or upload the e-Doręczenia PDF. You see the verbatim Polish beside the explanation, a link to the conversation that led to it, the deadline computed in code with every step shown, and a Polish cover letter drafted for you.",
    models: ["Super VL vision", "Nemotron 3 Ultra whole-case reasoning", "Deadline in code"],
    photo: { src: "/landing/letter-hands.jpg", alt: "Hands holding an official letter from the voivodeship office", tone: "paper" },
    main: <LetterMock />, aside: <DraftMock />,
  },
];

export function Journey() {
  return (
    <section className="lp-section lp-wrap" id="how" aria-labelledby="how-h">
      <div className="lp-head" data-reveal>
        <span className="lp-kicker">How it works</span>
        <h2 id="how-h">One agent with you before, during and after every visit.</h2>
        <p>From the first appointment to the last letter, your agent works from the same case, so nothing has to be explained twice.</p>
      </div>

      <nav className="lp-steps-nav" aria-label="Journey steps">
        {STEPS.map((s, i) => (
          <a key={s.id} href={`#step-${s.id}`} data-step-link={s.id} className={i === 0 ? "is-active" : undefined}>
            <span className="lp-steps-n" aria-hidden="true">{i + 1}</span>{s.tag}
          </a>
        ))}
      </nav>

      <ol className="lp-journey">
        {STEPS.map((s, i) => (
          <li key={s.id} id={`step-${s.id}`} data-step={s.id} className={`lp-jstep${i % 2 ? " is-flip" : ""}`}>
            <div className="lp-jcopy" data-reveal>
              <span className="lp-jtag"><b>{s.tag}</b> {s.name}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <ul className="lp-models" aria-label="Models and tools">
                {s.models.map((m) => <li key={m}>{m}</li>)}
              </ul>
            </div>
            <div className="lp-jvisual" data-reveal>
              {s.photo ? (
                <PhotoCard src={s.photo.src} alt={s.photo.alt} tone={s.photo.tone} className="lp-jcard">
                  <div className="lp-jmain">{s.main}</div>
                  {s.aside && <div className="lp-jaside">{s.aside}</div>}
                </PhotoCard>
              ) : (
                <div className="lp-jcard lp-jcard-plain">
                  <div className="lp-jmain">{s.main}</div>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
