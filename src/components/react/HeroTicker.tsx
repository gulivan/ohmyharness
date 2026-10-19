import CountUp from "./reactbits/CountUp";

interface Props {
  harnesses: number;
  orchestrators: number;
  cloudAgents: number;
  addOns: number;
  verified: string | null;
}

const ITEMS = [
  { key: "harnesses", label: "Harnesses", kind: "harness" },
  { key: "orchestrators", label: "Orchestrators", kind: "orchestrator" },
  { key: "cloudAgents", label: "Cloud agents", kind: "cloud-agent" },
  { key: "addOns", label: "Add-ons", kind: "add-on" },
] as const;

/**
 * A single horizontal stats line under the hero. Each count links to the
 * directory pre-filtered by that kind; the values are in the server HTML.
 */
export default function HeroTicker(props: Props) {
  return (
    <div className="hero-ticker" aria-label="Directory at a glance">
      {ITEMS.map((item, index) => (
        <a
          className="hero-ticker__item"
          href={`/?kind=${item.kind}#directory`}
          key={item.key}
        >
          <span className="hero-ticker__value">
            <CountUp
              to={props[item.key]}
              staticFirst
              trigger="view"
              duration={0.9}
              delay={index * 0.07}
            />
          </span>
          <span className="hero-ticker__label">{item.label}</span>
        </a>
      ))}
      <p className="hero-ticker__item hero-ticker__item--static">
        <span className="hero-ticker__dot" aria-hidden="true"></span>
        <span className="hero-ticker__label">
          {props.verified ? `Verified ${props.verified}` : "Awaiting first check"}
        </span>
      </p>
    </div>
  );
}
