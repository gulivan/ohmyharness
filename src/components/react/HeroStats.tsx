import CountUp from "./reactbits/CountUp";

interface Props {
  harnesses: number;
  orchestrators: number;
  cloudAgents: number;
  addOns: number;
}

const ROWS = [
  ["harnesses", "Harnesses"],
  ["orchestrators", "Orchestrators"],
  ["cloudAgents", "Cloud agents"],
  ["addOns", "Add-ons"],
] as const;

/** Directory counts; the final values are in the server HTML. */
export default function HeroStats(props: Props) {
  return (
    <dl className="hero__stats">
      {ROWS.map(([key, label], index) => (
        <div className="hero__stat" key={key}>
          <dt>{label}</dt>
          <dd>
            <CountUp
              to={props[key]}
              staticFirst
              trigger="view"
              duration={1}
              delay={index * 0.08}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}
