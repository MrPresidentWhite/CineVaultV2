import Link from "next/link";

type SectionProps = {
  title: string;
  href: string;
  children: React.ReactNode;
};

export function Section({ title, href, children }: SectionProps) {
  return (
    <section className="section mb-9 mt-7">
      <div className="mb-3.5 inline-block pr-20">
        <Link
          href={href}
          className="hero-link font-semibold text-text no-underline transition-colors duration-200 hover:text-accent"
        >
          <h2 className="m-0 ml-0.5 inline text-xl tracking-wide">{title}</h2>
        </Link>
      </div>
      {children}
    </section>
  );
}
