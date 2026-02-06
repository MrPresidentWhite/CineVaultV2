import Link from "next/link";

type SectionProps = {
  title: string;
  href: string;
  children: React.ReactNode;
};

export function Section({ title, href, children }: SectionProps) {
  return (
    <section className="section mb-6 mt-4 md:mb-9 md:mt-7">
      <div className="mb-3 inline-block pr-4 md:mb-3.5 md:pr-20">
        <Link
          href={href}
          className="hero-link font-semibold text-text no-underline transition-colors duration-200 hover:text-accent"
        >
          <h2 className="m-0 ml-0.5 inline text-lg tracking-wide md:text-xl">{title}</h2>
        </Link>
      </div>
      {children}
    </section>
  );
}
