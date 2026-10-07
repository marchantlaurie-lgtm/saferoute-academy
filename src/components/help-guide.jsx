import { useState } from "react";
import {
  BETA_GUIDE_UPDATED,
  FULL_GUIDE_SECTIONS,
  QUICK_START_GUIDES,
  normaliseGuideId,
} from "../data/beta-guide-content.js";

const tabs = [
  { id: "full", icon: "📘", label: "Full How To" },
  ...QUICK_START_GUIDES.map(guide => ({ id: guide.id, icon: guide.icon, label: guide.title })),
];

function FullGuide({ onOpenQuickStart }) {
  return (
    <div>
      <div className="guide-intro-card">
        <div className="guide-kicker">COMPLETE TESTER GUIDE</div>
        <h2>How to use the SafeRoute Academy beta</h2>
        <p>Work through the sections in order on a first visit, or open only the area you need. The role Quick Starts give shorter task lists for live testing.</p>
        <div className="guide-role-links">
          {QUICK_START_GUIDES.map(guide => (
            <button key={guide.id} onClick={() => onOpenQuickStart(guide.id)}>
              <span>{guide.icon}</span> {guide.title}
            </button>
          ))}
        </div>
      </div>

      <div className="guide-section-list">
        {FULL_GUIDE_SECTIONS.map((section, index) => (
          <details key={section.id} className="guide-section" open={index === 0 ? true : undefined}>
            <summary>{section.title}</summary>
            <div className="guide-section-content">
              {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              <ul>
                {section.items.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function QuickStart({ guide }) {
  return (
    <div>
      <div className="guide-intro-card">
        <div className="guide-quick-title"><span>{guide.icon}</span><div><div className="guide-kicker">ROLE QUICK START</div><h2>{guide.title}</h2></div></div>
        <p>{guide.purpose}</p>
      </div>

      <section className="guide-content-card">
        <h3>Start here</h3>
        <ol className="guide-steps">
          {guide.steps.map(step => <li key={step}>{step}</li>)}
        </ol>
      </section>

      <div className="guide-two-column">
        <section className="guide-content-card guide-test-card">
          <h3>What to evaluate</h3>
          <ul>
            {guide.testFocus.map(item => <li key={item}>{item}</li>)}
          </ul>
        </section>
        <section className="guide-content-card guide-caution-card">
          <h3>Important limits</h3>
          <ul>
            {guide.cautions.map(item => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function HelpGuideModal({ initialGuide = "full", onClose, onGuideChange }) {
  const [activeGuide, setActiveGuide] = useState(() => normaliseGuideId(initialGuide));

  function selectGuide(id) {
    const next = normaliseGuideId(id);
    setActiveGuide(next);
    onGuideChange?.(next);
  }

  const quickGuide = QUICK_START_GUIDES.find(guide => guide.id === activeGuide);

  return (
    <div className="guide-overlay" role="presentation" onClick={onClose}>
      <div className="guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={event => event.stopPropagation()}>
        <header className="guide-header">
          <div>
            <div className="guide-kicker">SAFEROUTE ACADEMY · CONTROLLED BETA</div>
            <div id="guide-title" className="guide-heading">HOW TO & QUICK START GUIDES</div>
            <div className="guide-updated">Rebuilt from scratch · Updated {BETA_GUIDE_UPDATED}</div>
          </div>
          <button className="guide-close" aria-label="Close How To guide" onClick={onClose}>×</button>
        </header>

        <div className="guide-safety-banner">
          <strong>Fictional shared test data only.</strong> Do not enter real personal, medical, training, maintenance or operational information. This beta is not an authoritative aviation record.
        </div>

        <nav className="guide-tabs" aria-label="How To guide sections">
          {tabs.map(tab => (
            <button key={tab.id} aria-pressed={activeGuide === tab.id} onClick={() => selectGuide(tab.id)}>
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </nav>

        <main key={activeGuide} className="guide-scroll-area">
          {activeGuide === "full"
            ? <FullGuide onOpenQuickStart={selectGuide}/>
            : <QuickStart guide={quickGuide}/>
          }
          <div className="guide-link-note">The current browser address opens this guide directly, so it can be bookmarked or sent to another invited tester.</div>
        </main>
      </div>
    </div>
  );
}
