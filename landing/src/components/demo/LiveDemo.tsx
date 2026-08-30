import { useEffect, useRef, useState } from 'react';
import type { AnalysisResult, Severity } from '../../vendor/tosly-ui/types';
import ResultPanel from '../../vendor/tosly-ui/result-panel';

/*
  The interactive demo renders the extension's REAL ResultPanel, imported
  unmodified from ../extension/components/result-panel.tsx. No screenshot, and
  no reimplementation that could drift from the product.

  The panel already dispatches a `tosly:scroll-to-highlight` CustomEvent when a
  flag is clicked (that is how the content script drives highlighting in a live
  page), so this component listens for the same event and highlights the matching
  sentence in the sample document below. The extension needed no changes.

  `detail.index` is the HIGHLIGHT index: the position among flags that carry a
  quote, not the position in `flags`. QUOTED mirrors that ordering.
*/

// Matches SEVERITY_HIGHLIGHT_STYLES in extension/content.ts so the marks in the
// demo look exactly like the marks the extension paints on a real page.
const HIGHLIGHT: Record<Severity, { background: string; outline: string }> = {
  red: { background: 'rgba(239,68,68,0.25)', outline: 'rgba(239,68,68,0.7)' },
  yellow: { background: 'rgba(234,179,8,0.2)', outline: 'rgba(234,179,8,0.65)' },
  green: { background: 'rgba(34,197,94,0.15)', outline: 'rgba(34,197,94,0.55)' },
};

const RESULT: AnalysisResult = {
  severity: 'red',
  summary:
    'This document sells your data to advertisers, blocks class actions, and renews itself unless you cancel in time. It does let you delete your account.',
  flags: [
    {
      category: 'Data Selling',
      severity: 'red',
      explanation:
        'Your personal data can be handed to advertising partners whenever they choose, with no notice to you.',
      quote: 'We may share your personal data with third-party advertising partners at our discretion.',
    },
    {
      category: 'Arbitration',
      severity: 'red',
      explanation:
        'If they overcharge thousands of people, everyone has to sue alone. No group cases.',
      quote: 'You waive your right to participate in class-action lawsuits or class-wide arbitration.',
    },
    {
      category: 'Auto-Renewal',
      severity: 'yellow',
      explanation:
        'The subscription continues charging unless you cancel a full day before the billing date.',
      quote: 'Your subscription renews automatically unless cancelled 24 hours before the billing date.',
    },
    {
      category: 'Data Deletion Rights',
      severity: 'green',
      explanation: 'You can have your account and its data erased on request, at any time.',
      quote: 'You may request complete deletion of your account and associated data at any time.',
    },
  ],
};

const QUOTED = RESULT.flags.filter((f) => f.quote);

/* The sample document. Paragraphs are split so quoted sentences can be marked. */
type Para = (string | { quote: string })[];
const DOCUMENT: { heading?: string; parts: Para }[] = [
  {
    heading: '1. Acceptance',
    parts: [
      'By creating an account or using the Service you agree to these terms in full. We may amend them at any time, and continued use after an amendment constitutes acceptance of the revised terms.',
    ],
  },
  {
    heading: '2. Your account',
    parts: [
      'You are responsible for maintaining the confidentiality of your credentials and for all activity that occurs under your account. We may suspend access where we reasonably suspect misuse.',
    ],
  },
  {
    heading: '3. Advertising and partners',
    parts: [
      'We work with a range of partners to fund and improve the Service. ',
      { quote: RESULT.flags[0].quote! },
      ' Partners may combine it with data they already hold about you to build a profile for targeting purposes.',
    ],
  },
  {
    heading: '4. Acceptable use',
    parts: [
      'You may not reverse engineer the Service, resell access, or use automated means to extract data at scale. We reserve the right to rate limit or terminate accounts that degrade the Service for others.',
    ],
  },
  {
    heading: '5. Content licence',
    parts: [
      'You retain ownership of the content you upload. You grant us a worldwide, royalty-free licence to host, reproduce and display that content solely to operate and improve the Service.',
    ],
  },
  {
    heading: '6. Third-party services',
    parts: [
      'The Service integrates with third-party providers whose own terms apply to their portion of the experience. We are not liable for the acts or omissions of those providers.',
    ],
  },
  {
    heading: '7. Disputes',
    parts: [
      'Any dispute arising from these terms will be resolved by binding individual arbitration in the venue we designate. ',
      { quote: RESULT.flags[1].quote! },
      ' This provision survives termination of your account.',
    ],
  },
  {
    heading: '8. Limitation of liability',
    parts: [
      'To the maximum extent permitted by law, our aggregate liability arising out of these terms will not exceed the greater of the amount you paid us in the preceding twelve months or fifty dollars.',
    ],
  },
  {
    heading: '9. Billing',
    parts: [
      'Paid plans are billed in advance on a recurring basis. ',
      { quote: RESULT.flags[2].quote! },
      ' We reserve the right to modify pricing with notice by email.',
    ],
  },
  {
    heading: '10. Taxes',
    parts: [
      'Fees are exclusive of taxes. You are responsible for any sales, use, value added or withholding taxes assessed by any jurisdiction on the fees payable under these terms.',
    ],
  },
  {
    heading: '11. Termination',
    parts: [
      'Either party may terminate at any time. On termination your right to access the Service ceases immediately, and sections that by their nature should survive will continue to apply.',
    ],
  },
  {
    heading: '12. Your rights',
    parts: [
      'You retain control over the information associated with your account. ',
      { quote: RESULT.flags[3].quote! },
      ' Requests are normally completed within thirty days.',
    ],
  },
];

export default function LiveDemo() {
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState<number | null>(null);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onScrollTo(e: Event) {
      const index = (e as CustomEvent<{ index: number }>).detail?.index;
      if (typeof index !== 'number') return;
      setActive(index);

      const mark = docRef.current?.querySelector<HTMLElement>(`[data-highlight="${index}"]`);
      const scroller = docRef.current;
      if (!mark || !scroller) return;
      // Scroll within the document pane only, so the page itself doesn't jump.
      scroller.scrollTo({
        top: mark.offsetTop - scroller.clientHeight / 2 + mark.offsetHeight / 2,
        behavior: 'smooth',
      });
    }
    document.addEventListener('tosly:scroll-to-highlight', onScrollTo);
    return () => document.removeEventListener('tosly:scroll-to-highlight', onScrollTo);
  }, []);

  let markIndex = -1;

  return (
    <div
      // `isolation` contains the panel's z-index (2147483646) so it cannot sit
      // above the site's sticky header.
      style={{ isolation: 'isolate' }}
      className="relative border border-navy/20 bg-white shadow-[0_24px_60px_-24px_rgba(0,6,61,0.4)]"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-navy/12 bg-paper-100 px-3 py-2.5">
        <span className="flex gap-1.5">
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <span key={c} className="block h-2.5 w-2.5 rounded-full" style={{ background: c }} />
          ))}
        </span>
        <span className="ml-2 flex-1 truncate bg-white px-2.5 py-1 font-mono text-[0.7rem] text-navy/55">
          example.com/terms
        </span>
        <span className="font-mono text-[0.62rem] text-navy/40">SAMPLE DOCUMENT</span>
      </div>

      {/* Document pane */}
      <div
        ref={docRef}
        className="relative h-[34rem] sm:h-[35rem] overflow-y-auto px-5 py-6 sm:px-8 sm:py-8"
        aria-label="Sample terms of service document"
      >
        <h3 className="mb-5 font-heading text-[1.35rem] font-semibold text-navy">Terms of Service</h3>

        {DOCUMENT.map((block) => (
          <div key={block.heading} className="mb-6">
            {block.heading && (
              <h4 className="mb-2 font-heading text-[0.95rem] font-semibold text-navy">{block.heading}</h4>
            )}
            <p className="text-[0.86rem] leading-[1.65] text-navy/75">
              {block.parts.map((part, i) => {
                if (typeof part === 'string') return <span key={i}>{part}</span>;
                markIndex += 1;
                const idx = markIndex;
                const sev = QUOTED[idx].severity as Severity;
                const style = HIGHLIGHT[sev];
                const isActive = active === idx;
                return (
                  <mark
                    key={i}
                    data-highlight={idx}
                    style={{
                      background: style.background,
                      outline: `${isActive ? 2 : 1}px solid ${style.outline}`,
                      outlineOffset: isActive ? 1 : 0,
                      borderRadius: 3,
                      padding: '1px 2px',
                      color: 'inherit',
                      font: 'inherit',
                      boxDecorationBreak: 'clone',
                      WebkitBoxDecorationBreak: 'clone',
                      transition: 'outline 0.15s ease, outline-offset 0.15s ease',
                    }}
                  >
                    {part.quote}
                  </mark>
                );
              })}
            </p>
          </div>
        ))}
      </div>

      {/* Shield button and the real panel, anchored like the extension does */}
      <div className="absolute bottom-4 right-4 flex flex-col items-center gap-2">
        <div className="relative">
          {open && (
            <ResultPanel result={RESULT} onDismiss={() => setOpen(false)} anchorAbove={true} />
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="tosly-demo-shield red"
          aria-expanded={open}
          aria-label={open ? 'Hide Tosly panel' : 'Show Tosly panel'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2l8 2.8v6.5c0 4.6-3.2 8.3-8 10.7-4.8-2.4-8-6.1-8-10.7V4.8L12 2z"
              stroke="#ef4444"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path d="M12 8v4.5M12 15.4v.4" stroke="#ef4444" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
          <span className="tosly-demo-label">High risk</span>
        </button>
      </div>
    </div>
  );
}
